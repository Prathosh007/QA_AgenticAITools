"""Zoho OAuth 2.0 token management.

Loads API credentials from a ``.env`` file and handles access-token
generation, caching, and automatic refresh before expiry.

Credentials (set in ``.env`` or the environment):
    CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN
Optional:
    TOKEN_URL      (default https://accounts.zoho.in/oauth/v2/token)
    ENV_FILE_PATH  (override the .env location)
"""
from __future__ import annotations

import os
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

try:  # works both as a package module and as a standalone script
    from .logger_config import api_logger, app_logger
except ImportError:  # pragma: no cover
    from logger_config import api_logger, app_logger

# .env path: ENV_FILE_PATH overrides, else .env beside this file.
_env_path = Path(os.environ.get("ENV_FILE_PATH", Path(__file__).parent / ".env"))
if not _env_path.exists():
    app_logger.warning(".env file not found at %s — credentials will be empty", _env_path)
load_dotenv(dotenv_path=_env_path)

TOKEN_URL = os.getenv("TOKEN_URL", "https://accounts.zoho.in/oauth/v2/token")
CLIENT_ID = os.getenv("CLIENT_ID")
CLIENT_SECRET = os.getenv("CLIENT_SECRET")
REFRESH_TOKEN = os.getenv("REFRESH_TOKEN")
GRANT_TYPE = "refresh_token"

if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
    app_logger.error(
        "Missing OAuth credentials — set CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN "
        "in %s (or set ENV_FILE_PATH).",
        _env_path,
    )

_access_token: str | None = None
_expiry_time: float = 0.0

# Credentials to scrub from any log output.
_SENSITIVE_VALUES = [v for v in (CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN) if v]


def _mask(text: object) -> str:
    """Replace any credential substring with a masked version."""
    s = str(text)
    for val in _SENSITIVE_VALUES:
        if val and val in s:
            s = s.replace(val, val[:6] + "***")
    return s


class AuthError(RuntimeError):
    """Raised when an access token cannot be obtained."""


def get_access_token() -> str:
    """Return a valid access token, refreshing it if needed (cached)."""
    global _access_token, _expiry_time

    if _access_token and time.time() < _expiry_time:
        return _access_token

    if not all([CLIENT_ID, CLIENT_SECRET, REFRESH_TOKEN]):
        raise AuthError(
            "OAuth credentials are missing. Set CLIENT_ID, CLIENT_SECRET and "
            f"REFRESH_TOKEN in {_env_path}."
        )

    payload = {
        "refresh_token": REFRESH_TOKEN,
        "client_id": CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "grant_type": GRANT_TYPE,
    }

    app_logger.info("Refreshing OAuth access token")
    t0 = time.time()
    try:
        response = requests.post(TOKEN_URL, data=payload, timeout=30)
        elapsed = int((time.time() - t0) * 1000)
        api_logger.info("POST %s → %s (%dms)", TOKEN_URL, response.status_code, elapsed)
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001 - re-raised after masking
        elapsed = int((time.time() - t0) * 1000)
        safe = _mask(exc)
        api_logger.error("POST %s → FAILED (%dms): %s", TOKEN_URL, elapsed, safe)
        raise AuthError(f"OAuth token refresh failed: {safe}") from None

    data = response.json()
    if "access_token" not in data:
        err = data.get("error", "unknown")
        raise AuthError(f"OAuth token response has no access_token: {err}")

    _access_token = data["access_token"]
    expires_in = int(data.get("expires_in", 3600))
    _expiry_time = time.time() + expires_in - 60  # refresh a minute early
    app_logger.info("OAuth token refreshed, expires in %ds", expires_in)
    return _access_token


def reset_token_cache() -> None:
    """Force the next :func:`get_access_token` call to refresh."""
    global _access_token, _expiry_time
    _access_token = None
    _expiry_time = 0.0
