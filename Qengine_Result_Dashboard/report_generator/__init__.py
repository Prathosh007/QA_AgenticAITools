"""QEngine Test Run Dashboard & Automation Report Generator.

A production-grade tool that retrieves a QEngine Test Plan execution result and
generates an interactive HTML dashboard, a professional PDF report, a JSON
summary and CSV/Excel exports.

The package auto-selects the best available data source:

    1. Official OAuth REST API   (preferred)
    2. Browser-cookie internal API (fallback)
    3. Offline HAR/JSON capture    (testing / air-gapped)
"""

__version__ = "1.0.0"
__all__ = ["__version__"]
