"""Interactive HTML dashboard generation (Jinja2 + Bootstrap 5)."""
from __future__ import annotations

import logging
from pathlib import Path

from jinja2 import Environment, FileSystemLoader, select_autoescape

from . import __version__
from .charts import Chart
from .models import ExecutionReport

log = logging.getLogger("report_generator.dashboard")

_TEMPLATE_DIR = Path(__file__).parent / "templates"
_STATIC_DIR = Path(__file__).parent / "static"


class DashboardBuilder:
    """Render the interactive Bootstrap dashboard to ``dashboard.html``."""

    def __init__(
        self,
        report: ExecutionReport,
        charts: dict[str, Chart],
        self_contained: bool = False,
    ) -> None:
        self.report = report
        self.charts = charts
        self.self_contained = self_contained
        self.env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html", "xml"]),
        )

    def render(self) -> str:
        css = ""
        css_path = _STATIC_DIR / "dashboard.css"
        if css_path.is_file():
            css = css_path.read_text(encoding="utf-8")
        chart_js = ""
        chart_js_path = _STATIC_DIR / "dashboard-charts.js"
        if chart_js_path.is_file():
            chart_js = chart_js_path.read_text(encoding="utf-8")
        # Inline Plotly so the charts render from any link / copied file.
        plotlyjs = ""
        if self.self_contained:
            try:
                from plotly.offline import get_plotlyjs

                plotlyjs = get_plotlyjs()
            except Exception as exc:  # pragma: no cover
                log.warning("Could not inline Plotly (%s); falling back to CDN.", exc)
        template = self.env.get_template("dashboard.html.j2")
        return template.render(
            report=self.report,
            s=self.report.summary,
            charts=self.charts,
            css=css,
            chart_js=chart_js,
            plotlyjs=plotlyjs,
            version=__version__,
        )

    def save(self, output_dir: Path) -> Path:
        output_dir.mkdir(parents=True, exist_ok=True)
        path = output_dir / "dashboard.html"
        path.write_text(self.render(), encoding="utf-8")
        log.info("Dashboard written → %s", path)
        return path
