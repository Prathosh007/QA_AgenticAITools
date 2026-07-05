"""Output generators: PDF report, JSON summary, CSV and Excel exports."""
from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

import pandas as pd
from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import __version__
from .charts import Chart
from .models import ExecutionReport

log = logging.getLogger("report_generator.report")

_TEMPLATE_DIR = Path(__file__).parent / "templates"


class ReportBuilder:
    """Produce the professional PDF report and the data exports."""

    def __init__(self, report: ExecutionReport, charts: dict[str, Chart]) -> None:
        self.report = report
        self.charts = charts
        self.env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html", "xml"]),
        )

    # -- PDF ----------------------------------------------------------------
    def render_report_html(self) -> str:
        template = self.env.get_template("report.html.j2")
        return template.render(
            report=self.report,
            s=self.report.summary,
            charts=self.charts,
            version=__version__,
        )

    def save_pdf(self, output_dir: Path) -> Optional[Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        html = self.render_report_html()
        path = output_dir / "dashboard.pdf"
        from .pdf_engine import render_pdf  # lazy import keeps deps optional

        return render_pdf(html, path, base_url=str(_TEMPLATE_DIR))

    # -- JSON ---------------------------------------------------------------
    def save_json(self, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / "report.json"
        path.write_text(self.report.to_json(), encoding="utf-8")
        log.info("JSON summary written → %s", path)
        return path

    # -- CSV / Excel --------------------------------------------------------
    def _dataframe(self) -> pd.DataFrame:
        return pd.DataFrame([c.to_row() for c in self.report.cases])

    def save_csv(self, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / "execution.csv"
        self._dataframe().to_csv(path, index=False, encoding="utf-8-sig")
        log.info("CSV export written → %s", path)
        return path

    def save_xlsx(self, output_dir: Path) -> Optional[Path]:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / "execution.xlsx"
        try:
            with pd.ExcelWriter(path, engine="openpyxl") as writer:
                self._summary_frame().to_excel(writer, sheet_name="Summary", index=False)
                self._dataframe().to_excel(writer, sheet_name="Test Cases", index=False)
                if self.report.failed_cases:
                    self._failure_frame().to_excel(writer, sheet_name="Failures", index=False)
            log.info("Excel export written → %s", path)
            return path
        except Exception as exc:  # pragma: no cover
            log.error("Excel export failed (%s).", exc)
            return None

    def _summary_frame(self) -> pd.DataFrame:
        s = self.report.summary
        rows = [
            ("Topic", s.topic_name),
            ("Project", s.project_name),
            ("Test Plan", s.test_plan_name),
            ("Test Suite(s)", s.test_suite_name),
            ("Test Run ID", s.test_run_id),
            ("Build", s.build_number),
            ("Environment", s.environment),
            ("Executed By", s.executed_by),
            ("Started", s.started_time),
            ("Ended", s.end_time),
            ("Duration", s.total_duration),
            ("Status", s.execution_status),
            ("Total Cases", s.total_cases),
            ("Passed", s.passed),
            ("Failed", s.failed),
            ("Skipped", s.skipped),
            ("Pass %", s.pass_percentage),
            ("Fail %", s.fail_percentage),
        ]
        return pd.DataFrame(rows, columns=["Field", "Value"])

    def _failure_frame(self) -> pd.DataFrame:
        rows = []
        for c in self.report.failed_cases:
            f = c.failure
            rows.append(
                {
                    "S.No": c.s_no,
                    "Test Case": c.name,
                    "Suite": c.suite,
                    "Failure Reason": c.failure_reason,
                    "Exception Type": f.exception_type if f else "",
                    "Error Remarks": f.assertion_failure if f else "",
                    "Suggested Root Cause": f.suggested_root_cause if f else "",
                    "Stack Trace": f.stack_trace if f else "",
                    "Screenshot": c.screenshot,
                }
            )
        return pd.DataFrame(rows)
