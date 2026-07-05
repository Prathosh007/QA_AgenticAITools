"""Lightweight logger shim exposing ``app_logger`` and ``api_logger``.

Keeps the OAuth token manager (auth.py) drop-in compatible while routing
through the package's logging configuration.
"""
from __future__ import annotations

import logging

app_logger = logging.getLogger("report_generator.app")
api_logger = logging.getLogger("report_generator.api.http")

__all__ = ["app_logger", "api_logger"]
