"""Artifact collection: log zips + failure screenshots.

Per the chosen integration model the tool runs on the GOAT server, gathers:

  * **Log zips** staged by the upload test case (``C:\\temp\\upload_staging\\
    <Topic>\\*.zip``) and any already in ``UploadFiles``;
  * **Failure screenshots** from GOAT's ``Screenshots_*`` dirs and/or a
    configured screenshot directory (e.g. ``…/AgentBinaries/Screenshot``);

publishes them centrally (copies into ``UploadFiles`` and/or uploads via the
GOAT ``/files/upload`` API) and produces linkable / embeddable records.
"""
from __future__ import annotations

import base64
import logging
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

from .goat import GoatClient

log = logging.getLogger("report_generator.artifacts")

_IMAGE_EXT = {".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"}
_MAX_EMBED_BYTES = 4 * 1024 * 1024  # don't inline screenshots larger than 4 MB


@dataclass
class LogArtifact:
    """A collected log archive (Agent or DS), tagged with machine + protocol."""

    name: str
    size_bytes: int = 0
    machine: str = ""
    protocol: str = ""
    kind: str = "Agent"  # "Agent" | "DS"
    download_url: str = ""
    local_path: str = ""

    @property
    def size_human(self) -> str:
        return _human_size(self.size_bytes)

    @property
    def label(self) -> str:
        bits = [self.machine or "unknown"]
        if self.protocol:
            bits.append(self.protocol)
        return " · ".join(bits)


@dataclass
class ScreenshotArtifact:
    """A collected screenshot (linked and optionally embedded inline)."""

    name: str
    download_url: str = ""
    data_uri: str = ""
    local_path: str = ""
    case_hint: str = ""  # testcase id/name parsed from the folder/filename


@dataclass
class ArtifactBundle:
    logs: list[LogArtifact] = field(default_factory=list)
    screenshots: list[ScreenshotArtifact] = field(default_factory=list)

    @property
    def has_data(self) -> bool:
        return bool(self.logs or self.screenshots)


class ArtifactCollector:
    """Gathers, publishes and links log/screenshot artifacts."""

    def __init__(
        self,
        upload_dir: Optional[str] = None,
        *,
        client: Optional[GoatClient] = None,
        embed_screenshots: bool = True,
        max_screenshots: int = 6,
    ) -> None:
        self.upload_dir = Path(upload_dir).expanduser() if upload_dir else None
        self.client = client
        self.embed_screenshots = embed_screenshots
        self.max_screenshots = max_screenshots

    # -- public -------------------------------------------------------------
    def collect(
        self,
        *,
        log_globs: list[str],
        screenshot_dirs: list[str],
        topic: str = "",
        window: Optional[tuple] = None,
    ) -> ArtifactBundle:
        bundle = ArtifactBundle()
        bundle.logs = self._collect_logs(log_globs, topic)
        bundle.screenshots = self._collect_screenshots(screenshot_dirs, window)
        log.info(
            "Collected %d log archive(s)%s and %d screenshot(s).",
            len(bundle.logs),
            f" for topic '{topic}'" if topic else "",
            len(bundle.screenshots),
        )
        return bundle

    # -- logs ---------------------------------------------------------------
    def _collect_logs(self, log_globs: list[str], topic: str = "") -> list[LogArtifact]:
        seen: set[str] = set()
        artifacts: list[LogArtifact] = []
        topic_l = topic.lower().strip()
        for pattern in log_globs:
            for path in _glob(pattern):
                if not path.is_file() or path.suffix.lower() not in {".zip", ".7z"}:
                    continue
                key = path.name.lower()
                if key in seen:
                    continue
                # Only this topic's archives: by filename prefix OR parent folder.
                if topic_l and not (
                    key.startswith(topic_l) or path.parent.name.lower() == topic_l
                ):
                    continue
                seen.add(key)
                published = self._publish(path)
                kind, machine, protocol = parse_log_name(path.name)
                artifacts.append(
                    LogArtifact(
                        name=path.name,
                        size_bytes=path.stat().st_size,
                        machine=machine,
                        protocol=protocol,
                        kind=kind,
                        download_url=published or "",
                        local_path=str(path),
                    )
                )
        artifacts.sort(key=lambda a: a.name)
        return artifacts

    # -- screenshots --------------------------------------------------------
    def _collect_screenshots(
        self, screenshot_dirs: list[str], window: Optional[tuple] = None
    ) -> list[ScreenshotArtifact]:
        # Gather all candidate image files across the configured dirs.
        candidates: list[Path] = []
        seen_paths: set[str] = set()
        for d in screenshot_dirs:
            base = Path(d).expanduser()
            if not base.exists():
                continue
            files = [base] if base.is_file() else base.rglob("*")
            for path in files:
                if (
                    path.is_file()
                    and path.suffix.lower() in _IMAGE_EXT
                    and str(path) not in seen_paths
                ):
                    seen_paths.add(str(path))
                    candidates.append(path)

        # CRITICAL: the NativeGUI folder is global + accumulates screenshots
        # across many runs. Keep ONLY shots taken during THIS run's window so
        # stale/unrelated screenshots are never attached.
        if window and window[0] and window[1]:
            start, end = window
            kept = [p for p in candidates if _in_window(p, start, end)]
            log.info(
                "Screenshot window %s–%s: %d of %d in range.",
                start.strftime("%d-%b %H:%M"), end.strftime("%d-%b %H:%M"),
                len(kept), len(candidates),
            )
            candidates = kept

        # Most relevant first: failures (``error_*``) then newest by mtime.
        candidates.sort(
            key=lambda p: (p.name.lower().startswith("error"), p.stat().st_mtime),
            reverse=True,
        )
        if self.max_screenshots > 0:
            candidates = candidates[: self.max_screenshots]

        shots: list[ScreenshotArtifact] = []
        for path in candidates:
            published = self._publish(path)
            shot = ScreenshotArtifact(
                name=path.name,
                download_url=published or "",
                local_path=str(path),
                case_hint=_case_hint_from_path(path),
            )
            if self.embed_screenshots:
                shot.data_uri = _to_data_uri(path)
            shots.append(shot)
        return shots

    # -- publishing ---------------------------------------------------------
    def _publish(self, path: Path) -> Optional[str]:
        """Copy into UploadFiles and/or upload via the API; return a URL."""
        url: Optional[str] = None

        # 1) Copy into the central UploadFiles directory (if configured).
        if self.upload_dir:
            try:
                self.upload_dir.mkdir(parents=True, exist_ok=True)
                dest = self.upload_dir / path.name
                if not dest.exists() or dest.stat().st_size != path.stat().st_size:
                    shutil.copy2(path, dest)
            except OSError as exc:
                log.debug("Could not copy %s to UploadFiles: %s", path.name, exc)

        # 2) Build a download URL via the GOAT API (preferred for the link).
        if self.client:
            # If not already present centrally, push it via the API.
            stored = self.client.upload_file(path) if not self.upload_dir else path.name
            if stored:
                url = self.client.download_url(stored)
        return url


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def _glob(pattern: str) -> list[Path]:
    p = Path(pattern)
    if p.is_absolute():
        anchor = Path(p.anchor)
        rel = str(p.relative_to(anchor))
        return list(anchor.glob(rel)) if any(c in rel for c in "*?[") else (
            [p] if p.exists() else []
        )
    return list(Path().glob(pattern))


def _to_data_uri(path: Path) -> str:
    try:
        if path.stat().st_size > _MAX_EMBED_BYTES:
            return ""
        mime = {
            ".png": "image/png",
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".gif": "image/gif",
            ".bmp": "image/bmp",
            ".webp": "image/webp",
        }.get(path.suffix.lower(), "image/png")
        encoded = base64.b64encode(path.read_bytes()).decode("ascii")
        return f"data:{mime};base64,{encoded}"
    except OSError as exc:
        log.debug("Could not embed screenshot %s: %s", path, exc)
        return ""


#: Known protocol tokens found in staged zip names.
_PROTOCOL_TOKENS = {
    "winhttp": "WinHTTP", "winttp": "WinHTTP", "http": "HTTP",
    "poco": "Poco", "tls": "TLS", "https": "HTTPS",
}


def parse_log_name(name: str) -> tuple[str, str, str]:
    """Parse ``<Topic>_<machine>_<Protocol>_(Agentlogs|DS_logs).zip``.

    Returns ``(kind, machine, protocol)`` where kind is "Agent" or "DS". The
    topic may itself contain underscores, so machine is the hostname-like token
    (hyphen/digit) and protocol is matched against known tokens.
    """
    import re

    low = name.lower()
    kind = "DS" if ("_ds_logs" in low or "_ds_log" in low or "_ds_" in low) else "Agent"

    stem = re.sub(r"\.(zip|7z)$", "", name, flags=re.IGNORECASE)
    for suffix in ("_Agentlogs", "_DS_logs", "_DS_Logs", "_Agentlog", "_logs", "_Logs"):
        if stem.lower().endswith(suffix.lower()):
            stem = stem[: -len(suffix)]
            break
    tokens = stem.split("_")

    protocol = ""
    for tok in tokens:
        if tok.lower() in _PROTOCOL_TOKENS:
            protocol = _PROTOCOL_TOKENS[tok.lower()]
            break

    machine = ""
    for tok in tokens:
        if tok.lower() in _PROTOCOL_TOKENS:
            continue
        if "-" in tok or re.search(r"\d", tok):
            machine = tok
            break
    if not machine and len(tokens) >= 3:
        machine = tokens[1]
    return kind, machine, protocol


def _machine_from_name(name: str) -> str:
    """Back-compat shim — returns just the machine token."""
    return parse_log_name(name)[1]


def _in_window(path: Path, start, end) -> bool:
    """True if the screenshot was taken within [start, end] (±5 min margin).

    Uses the ``_YYYYMMDD_HHMMSS`` stamp in the filename when present, else the
    file's modification time.
    """
    import re
    from datetime import datetime, timedelta

    ts = None
    m = re.search(r"(\d{8})_(\d{6})", path.name)
    if m:
        try:
            ts = datetime.strptime(m.group(1) + m.group(2), "%Y%m%d%H%M%S")
        except ValueError:
            ts = None
    if ts is None:
        try:
            ts = datetime.fromtimestamp(path.stat().st_mtime)
        except OSError:
            return False
    margin = timedelta(minutes=5)
    return (start - margin) <= ts <= (end + margin)


def _case_hint_from_path(path: Path) -> str:
    """Derive a case hint from a screenshot path/filename.

    Handles both GOAT layouts:
      * ``Screenshots_<caseId>/...png``
      * ``…/NativeGUI/Screenshots/error_step-001-<Action>_<timestamp>.png``
    """
    import re

    parent = path.parent.name
    if parent.lower().startswith("screenshots_"):
        return parent[len("Screenshots_"):]
    stem = path.stem
    stem = re.sub(r"^error[_-]+", "", stem, flags=re.IGNORECASE)
    stem = re.sub(r"[_-]?\d{8}[_-]\d{6}$", "", stem)  # trailing _YYYYMMDD_HHMMSS
    stem = re.sub(r"^step[-_]?\d+[-_\s]*", "", stem, flags=re.IGNORECASE)
    return stem.strip(" -_") or path.stem


def _human_size(num: int) -> str:
    size = float(num)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} GB"
