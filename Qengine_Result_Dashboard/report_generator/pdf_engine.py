"""Multi-engine HTML→PDF rendering with graceful degradation.

Engines are tried in order until one succeeds:

    1. WeasyPrint            — pure-Python, but needs native GTK/Pango libs.
    2. Chromium headless     — Chrome / Edge ``--headless --print-to-pdf``
                               (very reliable on Windows; no extra install).
    3. Printable HTML        — last-resort fallback that always works.
"""
from __future__ import annotations

import logging
import os
import shutil
import subprocess
import tempfile
from pathlib import Path
from typing import Optional

log = logging.getLogger("report_generator.pdf")

_CHROME_CANDIDATES = [
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Microsoft\Edge\Application\msedge.exe",
]


def render_pdf(html: str, output: Path, base_url: str = "") -> Optional[Path]:
    """Render ``html`` to ``output`` (a .pdf path). Returns the path written.

    On total failure, writes a printable ``.html`` next to ``output`` and
    returns that path instead, so the pipeline never hard-fails on PDF.
    """
    for engine in (_try_weasyprint, _try_chromium):
        result = engine(html, output, base_url)
        if result is not None:
            return result

    fallback = output.with_name("report_print.html")
    fallback.write_text(html, encoding="utf-8")
    log.warning(
        "No PDF engine available. Wrote printable HTML → %s "
        "(open it in a browser and 'Print to PDF').",
        fallback,
    )
    return fallback


def _try_weasyprint(html: str, output: Path, base_url: str) -> Optional[Path]:
    # WeasyPrint prints a multi-line GTK warning straight to stderr at import
    # time when native libs are missing (common on Windows). Silence it — we
    # fall back to Chromium cleanly.
    import contextlib
    import io

    try:
        with contextlib.redirect_stderr(io.StringIO()):
            from weasyprint import HTML  # noqa: WPS433 (lazy import is intentional)
    except Exception as exc:  # pragma: no cover - environment dependent
        log.debug("WeasyPrint unavailable: %s", exc)
        return None
    try:
        HTML(string=html, base_url=base_url or None).write_pdf(str(output))
        log.info("PDF rendered via WeasyPrint → %s", output)
        return output
    except Exception as exc:  # pragma: no cover
        log.debug("WeasyPrint render failed: %s", exc)
        return None


def _find_chromium() -> Optional[str]:
    for name in ("chrome", "chromium", "chromium-browser", "msedge"):
        found = shutil.which(name)
        if found:
            return found
    for candidate in _CHROME_CANDIDATES:
        if os.path.isfile(candidate):
            return candidate
    return None


def _try_chromium(html: str, output: Path, base_url: str) -> Optional[Path]:
    browser = _find_chromium()
    if not browser:
        log.debug("No Chromium/Edge binary found for PDF rendering.")
        return None

    # Chromium prints from a file:// URL; write the HTML to a temp file.
    tmp_dir = Path(tempfile.mkdtemp(prefix="qengine_pdf_"))
    tmp_html = tmp_dir / "report.html"
    tmp_html.write_text(html, encoding="utf-8")
    try:
        cmd = [
            browser,
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            f"--print-to-pdf={output}",
            tmp_html.as_uri(),
        ]
        proc = subprocess.run(
            cmd, capture_output=True, text=True, timeout=120
        )
        if output.is_file() and output.stat().st_size > 0:
            log.info("PDF rendered via Chromium (%s) → %s", Path(browser).name, output)
            return output
        # Some older builds need the legacy --headless flag.
        cmd[1] = "--headless"
        subprocess.run(cmd, capture_output=True, text=True, timeout=120)
        if output.is_file() and output.stat().st_size > 0:
            log.info("PDF rendered via Chromium (legacy headless) → %s", output)
            return output
        log.debug("Chromium produced no PDF. stderr: %s", proc.stderr[:300])
        return None
    except (subprocess.TimeoutExpired, OSError) as exc:  # pragma: no cover
        log.debug("Chromium PDF render failed: %s", exc)
        return None
    finally:
        shutil.rmtree(tmp_dir, ignore_errors=True)
