"""CLI entry point for the QEngine Test Run Dashboard & Report Generator.

Examples
--------
Official OAuth API (preferred)::

    python -m report_generator.main \\
        --result-url "https://qengine.zoho.in/uems/projects/4443.../results/4443..." \\
        --oauth "<OAuth Token>" --output ./Reports

Browser-cookie fallback::

    python -m report_generator.main \\
        --result-url "<QEngine Result URL>" \\
        --cookie "<Browser Cookie>" --output ./Reports

Offline (no network), using a captured HAR::

    python -m report_generator.main --har Agent_Prelims.har --output ./Reports
"""
from __future__ import annotations

import argparse
import logging
import sys
from datetime import datetime
from pathlib import Path

from . import __version__
from .api import QEngineService
from .charts import ChartFactory
from .clients import AuthError, QEngineError
from .config import Config, ConfigError
from .dashboard import DashboardBuilder
from .logging_setup import configure_logging
from .parser import ResultParser
from .report import ReportBuilder


def build_arg_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="report_generator",
        description="Generate a QEngine Test Execution Dashboard & Automation Report.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--result-url", help="QEngine Result URL (fills project-id + env-id).")
    p.add_argument("--project-id", help="QEngine project id.")
    p.add_argument("--run-id", help="scheduleexecutions_id — resolves env id + Topic + reruns (OAuth).")
    p.add_argument("--env-id", help="executedenvironment_id (alternative to --run-id).")
    p.add_argument("--testplan-id", help="Test plan id (optional — enriches header metadata).")
    p.add_argument("--host", help="QEngine host (default https://qengine.zoho.in).")
    p.add_argument("--har", help="Path to a captured .har file (offline source).")
    p.add_argument("--output", default="./output", help="Output folder (default: ./output).")
    p.add_argument("--config", help="Path to a YAML config file.")
    p.add_argument(
        "--all-details",
        action="store_true",
        help="Fetch per-case detail for every case (slower; default: failed cases only).",
    )

    goat = p.add_argument_group("GOAT integration")
    goat.add_argument("--goat-home", help="GOAT install dir (e.g. D:\\GOAT). Enables GOAT enrichment.")
    goat.add_argument("--goat-url", help="GOAT REST base URL (default http://localhost:9295/api).")
    goat.add_argument("--test-id", help="GOAT run id (test_status folder). Blank = most recent run.")
    goat.add_argument("--topic", help="Topic name — only this topic's log zips are collected from staging.")
    goat.add_argument("--staging-dir", help="Staging dir the machines drop zips into (default C:\\Temp\\upload_staging).")
    goat.add_argument("--test-status-root", help="Explicit path to the GOAT test_status directory.")
    goat.add_argument("--upload-dir", help="Central UploadFiles dir (default <goat-home>/UploadFiles).")
    goat.add_argument(
        "--publish-via-api",
        action="store_true",
        help="Also POST collected artifacts to GOAT /files/upload (cross-machine links).",
    )

    p.add_argument(
        "--self-contained",
        action="store_true",
        help="Inline Plotly so dashboard.html renders from any link/copied file (no CDN).",
    )
    p.add_argument("-v", "--verbose", action="store_true", help="Enable debug logging.")
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    return p


def generate(config: Config, fetch_all: bool = False, log=None):
    """Run the full pipeline and write outputs. Returns the ExecutionReport.

    Reusable by both the CLI (:func:`run`) and the HTTP service (server.py).
    """
    log = log or logging.getLogger("report_generator")
    config.validate()
    log.info("Output folder: %s", config.output_path)

    generated_at = datetime.now().strftime("%d-%b-%Y %H:%M:%S")
    has_qengine = bool(config.env_id or config.run_id or config.har_file)

    if has_qengine:
        service = QEngineService(config)
        try:
            bundle = service.fetch(fetch_all_details=fetch_all)
        finally:
            service.close()
        log.info("Data acquired via source: %s", service.source.upper())
        report = ResultParser(bundle, generated_at=generated_at).parse()
    else:
        log.info("No QEngine source — building report from GOAT results only.")
        report = ResultParser({"source": "goat"}, generated_at=generated_at).parse()

    # The Topic is the runtime $Topicname the caller supplies; it wins over any
    # (often null) plan-level variablesName.
    if config.topic:
        report.summary.topic_name = config.topic

    if config.goat_enabled:
        _enrich_with_goat(config, report, log)

    if report.summary.total_cases == 0 and not report.cases:
        raise QEngineError("The test run appears to be empty — nothing to report.")

    # Logs uploaded to the service for this topic → link them in the dashboard.
    # On the CLI (no service), default to the package uploaded_logs folder so a
    # manual generate still picks up whatever was uploaded for this topic.
    if not config.uploaded_logs_dir and not config.uploads_root:
        default_logs = Path(__file__).parent / "output" / "uploaded_logs"
        if default_logs.is_dir():
            config.uploads_root = str(default_logs)
    if config.uploaded_logs_dir or config.uploads_root:
        _attach_uploaded_logs(config, report, log)

    log.info("Building charts …")
    charts = ChartFactory(report, with_images=config.make_pdf).build_all()

    out = config.output_path
    if config.make_html:
        DashboardBuilder(report, charts, self_contained=config.self_contained).save(out)
    rb = ReportBuilder(report, charts)
    if config.make_json:
        rb.save_json(out)
    if config.make_csv:
        rb.save_csv(out)
    if config.make_xlsx:
        rb.save_xlsx(out)
    if config.make_pdf:
        rb.save_pdf(out)

    log.info(
        "Done. %d cases · %d passed · %d failed · %.2f%% pass rate.",
        report.summary.total_cases,
        report.summary.passed,
        report.summary.failed,
        report.summary.pass_percentage,
    )
    return report


def run(config: Config, fetch_all: bool, log) -> int:
    """CLI wrapper around :func:`generate` returning a process exit code."""
    try:
        generate(config, fetch_all=fetch_all, log=log)
    except QEngineError as exc:
        log.error("%s", exc)
        return 3
    return 0


def _attach_uploaded_logs(config: Config, report, log) -> None:
    """Add log zips uploaded to the service (for this topic) as artifacts.

    Tries multiple candidate folder names so that the webhook always finds the
    right logs regardless of whether it was called with the Topic variable name,
    the test plan name, or no topic at all:

      1. safe_name(config.topic)              – what the webhook URL passed
      2. safe_name(report.summary.topic_name) – $Topic variable resolved from API
      3. safe_name(report.summary.test_plan_name) – test plan / schedule name
      4. Fuzzy: any sub-folder whose zips start with any of the above prefixes
    """
    from urllib.parse import quote

    from .artifacts import LogArtifact, parse_log_name
    from .config import safe_name

    if config.uploaded_logs_dir:
        # Explicit single directory — use it directly (original behaviour).
        _attach_from_dir(
            Path(config.uploaded_logs_dir),
            config.uploads_base_url,
            config,
            report,
            log,
        )
        return

    if not config.uploads_root:
        return

    log_root = Path(config.uploads_root)
    if not log_root.is_dir():
        return

    # Build an ordered list of candidate folder names (deduplicated, non-empty).
    candidates: list[str] = []
    for raw in (
        config.topic,
        report.summary.topic_name,
        report.summary.test_plan_name,
    ):
        key = safe_name((raw or "").strip())
        if key and key not in candidates:
            candidates.append(key)

    # Extend with any subdirectory whose zips begin with one of the candidate prefixes
    # (case-insensitive). This handles partial-name mismatches like
    # "Prathosh_Test" webhook topic vs "prathosh_test" upload folder.
    found_dirs: list[Path] = []
    for sub in sorted(log_root.iterdir()):
        if not sub.is_dir():
            continue
        sub_key = sub.name.lower()
        # Direct name match (case-insensitive).
        if any(sub_key == c.lower() for c in candidates):
            if sub not in found_dirs:
                found_dirs.append(sub)
            continue
        # Zip prefix match: any zip in this folder starts with a candidate name.
        for p in list(sub.glob("*.zip")) + list(sub.glob("*.7z")):
            fname_l = p.name.lower()
            if any(fname_l.startswith(c.lower() + "_") or fname_l.startswith(c.lower() + ".") for c in candidates):
                if sub not in found_dirs:
                    found_dirs.append(sub)
                break

    if not found_dirs:
        log.info(
            "No uploaded logs found for topic candidates %s under %s",
            candidates, log_root,
        )
        return

    for d in found_dirs:
        base_url = config.uploads_base_url_root.rstrip("/") + "/" + d.name
        added = _attach_from_dir(d, base_url, config, report, log)
        log.info(
            "Attached %d uploaded log archive(s) from folder '%s'.", added, d.name
        )


def _attach_from_dir(d: Path, base_url: str, config, report, log) -> int:
    """Attach all zips in directory *d* to *report.log_artifacts*. Returns count added."""
    from urllib.parse import quote
    from .artifacts import LogArtifact, parse_log_name

    existing = {a.name.lower() for a in report.log_artifacts}
    added = 0
    for p in sorted(d.glob("*.zip")) + sorted(d.glob("*.7z")):
        if p.name.lower() in existing:
            continue
        url = (base_url.rstrip("/") + "/" + quote(p.name)) if base_url else ""
        kind, machine, protocol = parse_log_name(p.name)
        report.log_artifacts.append(
            LogArtifact(
                name=p.name,
                size_bytes=p.stat().st_size,
                machine=machine,
                protocol=protocol,
                kind=kind,
                download_url=url,
                local_path=str(p),
            )
        )
        added += 1
    return added


def _run_window(report):
    """(start, end) datetimes for this run, for screenshot time-filtering."""
    from datetime import datetime

    fmt = "%d-%b-%Y %H:%M"
    s = report.summary
    try:
        start = datetime.strptime(s.started_time, fmt)
        end = datetime.strptime(s.end_time, fmt)
        return (start, end)
    except (ValueError, TypeError):
        return None


def _enrich_with_goat(config: Config, report, log) -> None:
    """Merge GOAT local results + collected artifacts into the report."""
    from .artifacts import ArtifactCollector
    from .goat import GoatClient, GoatLocalStore
    from .merge import merge_goat

    config.resolve_goat_defaults(topic=report.summary.topic_name)
    log.info("GOAT enrichment enabled (home=%s).", config.goat_home or config.test_status_root)

    # 1) Local results (remarks / errors).
    store = GoatLocalStore(config.goat_home, config.test_status_root, config.test_id)
    goat_results = {}
    try:
        goat_results = store.load_results()
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("Could not read GOAT local results: %s", exc)

    # 2) Optional REST client for publishing artifacts cross-machine.
    client = None
    if config.publish_via_api:
        client = GoatClient(config.goat_url, timeout=config.timeout, retries=config.retries)
        if not client.health():
            log.warning("GOAT REST server not reachable at %s; using file copy only.", config.goat_url)
            client = None

    # 3) Collect artifacts (logs + screenshots), including per-run Screenshots_*.
    screenshot_dirs = list(config.screenshot_dirs)
    screenshot_dirs += [str(p) for p in store.screenshot_dirs()]
    collector = ArtifactCollector(
        upload_dir=config.upload_dir or None,
        client=client,
        embed_screenshots=config.embed_screenshots,
    )
    bundle = collector.collect(
        log_globs=config.log_globs,
        screenshot_dirs=screenshot_dirs,
        topic=config.effective_topic,
        window=_run_window(report),
    )

    # 4) Merge everything into the report.
    merge_goat(report, goat_results, bundle)
    if client:
        client.close()


def main(argv: list[str] | None = None) -> int:
    args = build_arg_parser().parse_args(argv)
    log = configure_logging(verbose=args.verbose)
    try:
        config = Config.from_args_and_file(args)
        return run(config, fetch_all=args.all_details, log=log)
    except ConfigError as exc:
        log.error("Configuration error: %s", exc)
        return 2
    except AuthError as exc:
        log.error("Authentication error: %s", exc)
        return 4
    except QEngineError as exc:
        log.error("QEngine error: %s", exc)
        return 5
    except KeyboardInterrupt:  # pragma: no cover
        log.warning("Interrupted by user.")
        return 130
    except Exception as exc:  # pragma: no cover
        log.exception("Unexpected error: %s", exc)
        return 1


if __name__ == "__main__":
    sys.exit(main())
