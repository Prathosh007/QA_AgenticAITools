"""Centralised logging configuration with progress-friendly formatting."""
from __future__ import annotations

import logging
import sys

_LEVEL_COLORS = {
    "DEBUG": "\033[37m",
    "INFO": "\033[36m",
    "WARNING": "\033[33m",
    "ERROR": "\033[31m",
    "CRITICAL": "\033[41m",
}
_RESET = "\033[0m"


class _ColorFormatter(logging.Formatter):
    """A formatter that colourises the level name when the stream is a TTY."""

    def __init__(self, fmt: str, use_color: bool) -> None:
        super().__init__(fmt, datefmt="%H:%M:%S")
        self._use_color = use_color

    def format(self, record: logging.LogRecord) -> str:
        if self._use_color:
            color = _LEVEL_COLORS.get(record.levelname, "")
            record.levelname = f"{color}{record.levelname:<7}{_RESET}"
        else:
            record.levelname = f"{record.levelname:<7}"
        return super().format(record)


def configure_logging(verbose: bool = False) -> logging.Logger:
    """Configure the root logger for the tool and return the package logger.

    Args:
        verbose: When ``True`` the log level is set to ``DEBUG``.

    Returns:
        The ``report_generator`` logger instance.
    """
    level = logging.DEBUG if verbose else logging.INFO
    handler = logging.StreamHandler(sys.stderr)
    use_color = hasattr(sys.stderr, "isatty") and sys.stderr.isatty()
    handler.setFormatter(
        _ColorFormatter("%(asctime)s %(levelname)s %(name)s: %(message)s", use_color)
    )

    root = logging.getLogger()
    root.handlers.clear()
    root.addHandler(handler)
    root.setLevel(level)

    # Quieten noisy third-party loggers.
    logging.getLogger("urllib3").setLevel(logging.WARNING)
    logging.getLogger("weasyprint").setLevel(logging.ERROR)
    logging.getLogger("fontTools").setLevel(logging.ERROR)
    # Chart/PDF rendering back-ends are very chatty at INFO.
    for noisy in ("kaleido", "choreographer", "logistro"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return logging.getLogger("report_generator")
