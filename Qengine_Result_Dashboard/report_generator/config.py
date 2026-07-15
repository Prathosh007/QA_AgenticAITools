"""Configuration handling: CLI args + optional YAML config file.

Precedence (highest first): CLI arguments → config file → built-in defaults.
"""
from __future__ import annotations

import os
import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
from urllib.parse import urlparse

try:  # PyYAML is optional at import time so `--help` works without it.
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore[assignment]


class ConfigError(ValueError):
    """Raised when configuration is invalid or insufficient."""


def safe_name(name: str) -> str:
    """Filesystem-safe key shared by the uploader and the dashboard reader."""
    return "".join(c if c.isalnum() or c in "-_." else "_" for c in str(name))[:120] or "run"


@dataclass
class Config:
    """Runtime configuration for a single report generation run."""

    result_url: str = ""
    har_file: Optional[str] = None
    output: str = "./output"
    verbose: bool = False

    # Official v1 API identifiers.
    host: str = "https://qengine.zoho.in"
    api_base: str = ""            # full override of the API prefix (optional)
    project_id: str = ""
    env_id: str = ""             # executedenvironment_id — the run's iteration
    run_id: str = ""             # scheduleexecutions_id — resolves env_id + Topic + reruns (OAuth)
    testplan_id: str = ""        # optional — enriches header metadata (v1 /testplans)

    # Network behaviour.
    timeout: int = 30
    retries: int = 3
    backoff: float = 1.5
    page_size: int = 100

    # Uploaded logs (POSTed to the service by the upload-logs case).
    uploaded_logs_dir: str = ""    # explicit dir of zips for this topic (optional)
    uploads_base_url: str = ""     # explicit base URL for the above (optional)
    # Root forms — the topic sub-folder is resolved at runtime (handles the
    # webhook case where the topic isn't known until execution_id is resolved).
    uploads_root: str = ""         # e.g. <output>/uploaded_logs
    uploads_base_url_root: str = ""  # e.g. http://host:8089/uploads

    # Output toggles.
    self_contained: bool = False   # inline Plotly so the HTML renders from any link/file
    make_html: bool = True
    make_pdf: bool = True
    make_json: bool = True
    make_csv: bool = True
    make_xlsx: bool = True

    # -- GOAT integration ---------------------------------------------------
    goat_enabled: bool = False
    goat_url: str = "http://localhost:9295/api"
    goat_home: str = ""           # e.g. D:\GOAT  (test_status lives under product_package)
    test_status_root: str = ""    # explicit override of the test_status dir
    test_id: str = ""             # GOAT run id (folder); blank = most recent run
    topic: str = ""               # Topic name — only this topic's log zips are collected
    staging_dir: str = r"C:\Temp\upload_staging"  # where the 4 machines drop zips
    upload_dir: str = ""          # central UploadFiles dir; blank = <goat_home>/UploadFiles
    publish_via_api: bool = False  # also POST artifacts to GOAT /files/upload
    embed_screenshots: bool = True
    # Glob(s) for staged log zips, and dirs holding failure screenshots.
    log_globs: list = field(default_factory=list)
    screenshot_dirs: list = field(default_factory=list)

    # -- Crash & CPU analysis -----------------------------------------------
    # List of agent machines to analyse.  Each entry is a dict:
    #   {"name": "AGENT-PC-01", "url": "http://192.168.1.10:9295/api"}
    # When empty, the single goat_url machine is used.
    goat_machines: list = field(default_factory=list)
    # Root directory of the Agent installation on the machine being tested.
    agent_install_dir: str = r"C:\Program Files (x86)\ManageEngine\UEMS_Agent"
    # Minimum CPU % to flag a process as high-CPU.
    cpu_threshold: float = 50.0
    # How many hours of crash history to retrieve from the Event Log.
    crash_hours: int = 24
    # Set to False to skip crash/CPU collection entirely.
    collect_machine_health: bool = True

    extra: dict[str, Any] = field(default_factory=dict)

    # -- result URL parsing -------------------------------------------------
    _URL_RE = re.compile(
        r"/projects/(?P<project>\d+)/results/(?P<env>\d+)", re.IGNORECASE
    )

    def parse_result_url(self) -> None:
        """Fill host / project id / env id from a result URL when provided.

        Example URL::

            https://qengine.zoho.in/uems/projects/4443000000022861/results/4443000074661122
        """
        if not self.result_url:
            return
        parsed = urlparse(self.result_url)
        if parsed.scheme and parsed.netloc:
            self.host = f"{parsed.scheme}://{parsed.netloc}"
        match = self._URL_RE.search(parsed.path)
        if match:
            self.project_id = self.project_id or match.group("project")
            self.env_id = self.env_id or match.group("env")

    def validate(self) -> None:
        """Validate inputs for the chosen mode.

        Live mode uses the official v1 OAuth API and needs ``project_id`` +
        ``env_id`` (executedenvironment_id). Offline HAR or GOAT-only modes
        relax that requirement.
        """
        self.parse_result_url()
        if self.har_file:
            return
        if not (self.env_id or self.run_id) and self.goat_enabled and not self.result_url:
            return  # GOAT-only mode
        if not self.project_id:
            raise ConfigError("Live mode needs --project-id (or PROJECT_ID in .env).")
        if not (self.env_id or self.run_id):
            raise ConfigError(
                "Live mode needs --env-id (executedenvironment_id) or --run-id "
                "(scheduleexecutions_id), or a --result-url; else use --har / --goat-home."
            )

    @property
    def output_path(self) -> Path:
        return Path(self.output).expanduser().resolve()

    @property
    def effective_topic(self) -> str:
        """Topic used to scope log collection (CLI/config topic preferred)."""
        return (self.topic or getattr(self, "_derived_topic", "") or "").strip()

    def resolve_goat_defaults(self, topic: str = "") -> None:
        """Fill sensible GOAT defaults derived from ``goat_home`` / topic."""
        if not self.goat_enabled:
            return
        self._derived_topic = topic
        home = Path(self.goat_home).expanduser() if self.goat_home else None
        staging = Path(self.staging_dir) if self.staging_dir else Path(r"C:\Temp\upload_staging")
        active_topic = self.effective_topic

        if not self.upload_dir and home:
            self.upload_dir = str(home / "UploadFiles")

        if not self.log_globs:
            # Collect ONLY the given topic's zips. The 4 machines drop their
            # archives in C:\Temp\upload_staging\<Topic>\ (subfoldered by topic);
            # we also cover a flat layout where the name is prefixed by topic.
            if active_topic:
                self.log_globs = [
                    str(staging / active_topic / "*.zip"),
                    str(staging / f"{active_topic}*.zip"),
                    str(staging / "**" / f"{active_topic}*.zip"),
                ]
            else:
                # No topic given — fall back to everything under staging.
                self.log_globs = [str(staging / "**" / "*.zip")]

        if not self.screenshot_dirs and home:
            # GOAT native-GUI failure screenshots (the real path) + legacy dirs.
            self.screenshot_dirs = [
                str(home / "product_package" / "bin" / "AgentBinaries"
                    / "Logs" / "NativeGUI" / "Screenshots"),
                str(home / "product_package" / "bin" / "AgentBinaries" / "Screenshot"),
            ]

    # -- factory ------------------------------------------------------------
    @classmethod
    def from_args_and_file(cls, args: Any) -> "Config":
        """Build a :class:`Config` from argparse Namespace + optional YAML."""
        data: dict[str, Any] = {}

        config_file = getattr(args, "config", None)
        if config_file:
            data.update(cls._load_file(config_file))

        # CLI overrides config file (only when explicitly provided).
        cli_map = {
            "result_url": getattr(args, "result_url", None),
            "har_file": getattr(args, "har", None),
            "output": getattr(args, "output", None),
            "verbose": getattr(args, "verbose", None),
            "self_contained": getattr(args, "self_contained", None),
            "project_id": getattr(args, "project_id", None),
            "env_id": getattr(args, "env_id", None),
            "run_id": getattr(args, "run_id", None),
            "testplan_id": getattr(args, "testplan_id", None),
            "host": getattr(args, "host", None),
            "goat_home": getattr(args, "goat_home", None),
            "goat_url": getattr(args, "goat_url", None),
            "test_id": getattr(args, "test_id", None),
            "test_status_root": getattr(args, "test_status_root", None),
            "upload_dir": getattr(args, "upload_dir", None),
            "publish_via_api": getattr(args, "publish_via_api", None),
            "topic": getattr(args, "topic", None),
            "staging_dir": getattr(args, "staging_dir", None),
        }
        for key, value in cli_map.items():
            if value not in (None, False) or key not in data:
                if value is not None:
                    data[key] = value

        # Filter unknown keys into `extra` so the YAML can hold anything.
        known = {f for f in cls.__dataclass_fields__ if f != "extra"}
        clean = {k: v for k, v in data.items() if k in known}
        extra = {k: v for k, v in data.items() if k not in known}
        cfg = cls(**clean)
        cfg.extra = extra
        # Ensure .env is loaded so PROJECT_ID / host defaults are available.
        try:
            from dotenv import load_dotenv

            load_dotenv(os.environ.get("ENV_FILE_PATH", Path(__file__).parent / ".env"))
        except ImportError:
            pass
        # Fall back to environment / .env for common defaults.
        cfg.project_id = cfg.project_id or os.environ.get("PROJECT_ID", "")
        if os.environ.get("QENGINE_HOST"):
            cfg.host = cfg.host or os.environ["QENGINE_HOST"]
        # Auto-enable GOAT enrichment when a home / status root is configured.
        if cfg.goat_home or cfg.test_status_root or data.get("goat_enabled"):
            cfg.goat_enabled = True
        return cfg

    @staticmethod
    def _load_file(path: str) -> dict[str, Any]:
        p = Path(path).expanduser()
        if not p.is_file():
            raise ConfigError(f"Config file not found: {path}")
        if yaml is None:
            raise ConfigError("PyYAML is required to read a config file.")
        with p.open("r", encoding="utf-8") as fh:
            loaded = yaml.safe_load(fh) or {}
        if not isinstance(loaded, dict):
            raise ConfigError("Config file must contain a top-level mapping.")
        return loaded
