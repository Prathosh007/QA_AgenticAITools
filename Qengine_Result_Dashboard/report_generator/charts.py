"""Chart generation via Plotly.

Produces, for each chart, both:
  * ``html`` — an interactive ``<div>`` for the HTML dashboard, and
  * ``img``  — a base64 PNG data-URI for the PDF report (best effort; PNG
    export needs the optional ``kaleido`` package — falls back to an SVG/HTML
    note when unavailable).
"""
from __future__ import annotations

import base64
import logging
from collections import Counter
from dataclasses import dataclass
from typing import Optional

import plotly.graph_objects as go

from .models import ExecutionReport, Status, format_duration_ms

log = logging.getLogger("report_generator.charts")

_COLORS = {
    Status.PASSED: "#10b981",
    Status.FAILED: "#ef4444",
    Status.SKIPPED: "#f59e0b",
    Status.UNKNOWN: "#94a3b8",
}
_LAYOUT = dict(
    template="plotly_white",
    margin=dict(l=40, r=24, t=54, b=44),
    font=dict(family="Segoe UI, Helvetica, Arial, sans-serif", size=13, color="#475569"),
    title_font=dict(size=16, color="#0f2b4a"),
    paper_bgcolor="rgba(0,0,0,0)",
    plot_bgcolor="rgba(0,0,0,0)",
    hoverlabel=dict(
        bgcolor="#0f2b4a", font=dict(color="#ffffff", size=12), bordercolor="#0f2b4a"
    ),
)


@dataclass
class Chart:
    """An interactive HTML div + a static image for PDF embedding."""

    title: str
    html: str = ""
    img: str = ""  # base64 data-URI


class ChartFactory:
    """Builds all dashboard charts from an :class:`ExecutionReport`."""

    def __init__(self, report: ExecutionReport, with_images: bool = True) -> None:
        self.report = report
        # Static PNG export (kaleido) is only needed for the PDF; skipping it
        # makes HTML-only generation ~10x faster (no Chrome spawns per chart).
        self.with_images = with_images
        self._kaleido_ok: Optional[bool] = None

    def build_all(self) -> dict[str, Chart]:
        return {
            "pass_fail_pie": self._pass_fail_pie(),
            "status_bar": self._status_bar(),
            "timeline": self._timeline(),
        }

    # -- individual charts --------------------------------------------------
    def _pass_fail_pie(self) -> Chart:
        s = self.report.summary
        labels, values, colors = [], [], []
        for status, count in (
            (Status.PASSED, s.passed),
            (Status.FAILED, s.failed),
            (Status.SKIPPED, s.skipped),
        ):
            if count:
                labels.append(status.value)
                values.append(count)
                colors.append(_COLORS[status])
        fig = go.Figure(
            go.Pie(
                labels=labels,
                values=values,
                hole=0.55,
                marker=dict(colors=colors, line=dict(color="#fff", width=2)),
                textinfo="label+percent",
                sort=False,
            )
        )
        fig.update_layout(title="Pass vs Fail", **_LAYOUT)
        fig.add_annotation(
            text=f"<b>{s.pass_percentage}%</b><br>Pass",
            showarrow=False,
            font=dict(size=18),
        )
        return self._render(fig, "Pass vs Fail")

    def _status_bar(self) -> Chart:
        s = self.report.summary
        statuses = [Status.PASSED, Status.FAILED, Status.SKIPPED]
        counts = [s.passed, s.failed, s.skipped]
        fig = go.Figure(
            go.Bar(
                x=[st.value for st in statuses],
                y=counts,
                marker_color=[_COLORS[st] for st in statuses],
                text=counts,
                textposition="outside",
            )
        )
        fig.update_layout(title="Test Case Status", yaxis_title="Cases", **_LAYOUT)
        return self._render(fig, "Test Case Status")

    def _timeline(self) -> Chart:
        cases = [c for c in self.report.cases if c.end_time]
        fig = go.Figure()
        if cases:
            fig.add_trace(
                go.Bar(
                    x=[c.duration_ms / 1000 for c in cases],
                    y=[f"{c.s_no}. {c.name}" for c in cases],
                    orientation="h",
                    marker_color=[_COLORS[c.status] for c in cases],
                    customdata=[c.duration_human for c in cases],
                    hovertemplate="%{y}<br>Duration: %{customdata}<extra></extra>",
                )
            )
        fig.update_layout(
            title="Execution Timeline (per case)",
            xaxis_title="Duration (seconds)",
            height=max(320, 26 * len(cases) + 120),
            yaxis=dict(autorange="reversed"),
            **_LAYOUT,
        )
        return self._render(fig, "Execution Timeline")

    def _duration_distribution(self) -> Chart:
        durations = [c.duration_ms / 1000 for c in self.report.cases if c.duration_ms]
        fig = go.Figure()
        if durations:
            fig.add_trace(
                go.Histogram(
                    x=durations,
                    nbinsx=min(20, max(5, len(durations))),
                    marker_color="#0d6efd",
                    opacity=0.85,
                )
            )
        fig.update_layout(
            title="Duration Distribution",
            xaxis_title="Duration (seconds)",
            yaxis_title="Number of cases",
            bargap=0.05,
            **_LAYOUT,
        )
        return self._render(fig, "Duration Distribution")

    def _failure_reasons(self) -> Chart:
        counter: Counter[str] = Counter()
        for case in self.report.failed_cases:
            reason = case.failure_reason or "Unspecified failure"
            # Use the exception type when present for a tighter grouping.
            if case.failure and case.failure.exception_type:
                reason = case.failure.exception_type
            counter[reason[:60]] += 1
        items = counter.most_common(10)
        fig = go.Figure()
        if items:
            labels = [k for k, _ in items][::-1]
            values = [v for _, v in items][::-1]
            fig.add_trace(
                go.Bar(
                    x=values,
                    y=labels,
                    orientation="h",
                    marker_color="#dc3545",
                    text=values,
                    textposition="outside",
                )
            )
        else:
            fig.add_annotation(
                text="No failures 🎉", showarrow=False, font=dict(size=16)
            )
        fig.update_layout(
            title="Top Failure Reasons",
            xaxis_title="Occurrences",
            height=max(300, 34 * len(items) + 120),
            **_LAYOUT,
        )
        return self._render(fig, "Top Failure Reasons")

    # -- rendering ----------------------------------------------------------
    def _render(self, fig: go.Figure, title: str) -> Chart:
        # Centralised polish applied to every chart: rounded, borderless bars
        # and soft, low-contrast gridlines that match the light-blue theme.
        fig.update_traces(
            selector=dict(type="bar"),
            marker_cornerradius=7,
            marker_line_width=0,
        )
        fig.update_xaxes(gridcolor="#eef2f7", zerolinecolor="#e6edf7", linecolor="#e6edf7")
        fig.update_yaxes(gridcolor="#eef2f7", zerolinecolor="#e6edf7", linecolor="#e6edf7")
        html = fig.to_html(
            full_html=False,
            include_plotlyjs=False,
            config={"displayModeBar": False, "responsive": True},
        )
        return Chart(title=title, html=html, img=self._to_image(fig))

    def _to_image(self, fig: go.Figure) -> str:
        """Render the figure to a base64 PNG data-URI for the PDF (best effort)."""
        if not self.with_images or self._kaleido_ok is False:
            return ""
        try:
            png = fig.to_image(format="png", width=720, height=fig.layout.height or 400, scale=2)
            self._kaleido_ok = True
            encoded = base64.b64encode(png).decode("ascii")
            return f"data:image/png;base64,{encoded}"
        except Exception as exc:  # kaleido missing / render failure
            if self._kaleido_ok is None:
                log.warning(
                    "Static chart export unavailable (%s). PDF will embed an "
                    "interactive-chart placeholder. Install 'kaleido' for PNGs.",
                    type(exc).__name__,
                )
            self._kaleido_ok = False
            return ""
