"""HTTP execute service for the QEngine dashboard.

Hit one URL with the run details and the dashboard is generated and served.

    GET/POST  /execute
        env_id        (required) executedenvironment_id — the run
        project_id    (optional) defaults to PROJECT_ID in .env
        testplan_id   (optional) enriches Topic / suites / users
        topic         (optional) scopes GOAT log-zip collection
        result_url    (optional) alternative to project_id+env_id
        goat_home     (optional) enable GOAT enrichment (logs/screenshots/remarks)
        format=html   (optional) redirect straight to the rendered dashboard

    GET /health
    GET /dashboards/<run>/<file>     (serves generated artifacts)

Run:
    python -m report_generator.server         # listens on 0.0.0.0:8089
    (or set DASHBOARD_PORT / DASHBOARD_OUTPUT_ROOT)
"""
from __future__ import annotations

import copy
import functools
import hashlib
import logging
import os
import secrets
import threading
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, redirect, request, send_from_directory, session, url_for

# Load .env so PROJECT_ID / OAuth creds are available at startup.
load_dotenv(os.environ.get("ENV_FILE_PATH", Path(__file__).parent / ".env"))

from .config import Config, ConfigError, safe_name as _safe
from .clients import AuthError, QEngineError
from .logging_setup import configure_logging
from .main import generate

log = configure_logging(verbose=bool(os.environ.get("DASHBOARD_VERBOSE")))

# Where generated dashboards are written (one sub-folder per run).
OUTPUT_ROOT = Path(
    os.environ.get("DASHBOARD_OUTPUT_ROOT", Path(__file__).parent / "output" / "runs")
).resolve()
# Where uploaded log zips are stored (one sub-folder per topic).
LOG_ROOT = Path(
    os.environ.get("DASHBOARD_LOG_ROOT", Path(__file__).parent / "output" / "uploaded_logs")
).resolve()
DEFAULT_PROJECT_ID = os.environ.get("PROJECT_ID", "")
_MAX_UPLOAD_MB = int(os.environ.get("DASHBOARD_MAX_UPLOAD_MB", "2048"))  # 2 GB

app = Flask(__name__)
app.secret_key = os.environ.get("DASHBOARD_SECRET_KEY", "qe-dash-s3cr3t-2026-!XkPq")

# ---------------------------------------------------------------------------
# Admin authentication
# ---------------------------------------------------------------------------
_ADMIN_USER = os.environ.get("ADMIN_USER", "prathosh")
_ADMIN_PASS_HASH = hashlib.sha256(
    os.environ.get("ADMIN_PASS", "Agent@123").encode()
).hexdigest()


def _admin_required(fn):
    """Decorator: redirect to /admin/login if not authenticated."""
    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        if not session.get("admin"):
            return redirect(url_for("admin_login", next=request.path))
        return fn(*args, **kwargs)
    return wrapper


def _param(name: str, default: str = "") -> str:
    """Read a parameter from query string or JSON body."""
    if request.method == "POST" and request.is_json:
        val = (request.get_json(silent=True) or {}).get(name)
        if val is not None:
            return str(val)
    return request.values.get(name, default)


@app.get("/health")
def health():
    return jsonify(status="ok", service="qengine-dashboard", output_root=str(OUTPUT_ROOT))


def _list_runs() -> list:
    """All generated dashboards, newest first, with summary from report.json."""
    import json as _json

    runs = []
    if not OUTPUT_ROOT.is_dir():
        return runs
    for d in OUTPUT_ROOT.iterdir():
        dash = d / "dashboard.html"
        if not dash.is_file():
            continue
        info = {"run": d.name, "mtime": dash.stat().st_mtime, "topic": "", "summary": ""}
        rj = d / "report.json"
        if rj.is_file():
            try:
                data = _json.loads(rj.read_text(encoding="utf-8"))
                s = data.get("summary", {})
                info["topic"] = s.get("topic_name", "")
                info["summary"] = (
                    f"{s.get('passed', 0)}/{s.get('total_cases', 0)} passed "
                    f"({s.get('pass_percentage', 0)}%)"
                )
            except (ValueError, OSError):
                pass
        runs.append(info)
    runs.sort(key=lambda r: r["mtime"], reverse=True)
    return runs


@app.get("/")
@app.get("/dashboards")
def index():
    """Landing page listing every generated dashboard (newest first)."""
    import time as _time

    base = request.host_url.rstrip("/")
    rows = []
    for r in _list_runs():
        when = _time.strftime("%d-%b-%Y %H:%M", _time.localtime(r["mtime"]))
        rows.append(
            f"<tr>"
            f"<td><a href='{base}/dashboards/{r['run']}/dashboard.html'>{r['topic'] or r['run']}</a></td>"
            f"<td>{r['run']}</td><td>{r['summary']}</td><td>{when}</td>"
            f"<td><a href='{base}/dashboards/{r['run']}/dashboard.pdf'>PDF</a></td>"
            f"</tr>"
        )
    body = "".join(rows) or "<tr><td colspan='5'>No dashboards yet.</td></tr>"
    html = (
        "<!doctype html><meta charset='utf-8'><title>QEngine Dashboards</title>"
        "<style>body{font-family:Segoe UI,Arial,sans-serif;margin:24px;}"
        "h2{color:#0d3b66;display:flex;align-items:center;justify-content:space-between}"
        "table{border-collapse:collapse;width:100%}"
        "th,td{border:1px solid #d0d7de;padding:8px 10px;text-align:left;font-size:14px}"
        "th{background:#0d3b66;color:#fff}tr:nth-child(even){background:#f6f8fa}"
        "a{color:#0d6efd;text-decoration:none}"
        ".admin-link{font-size:13px;font-weight:normal;color:#6c757d;border:1px solid #ccc;"
        "padding:4px 12px;border-radius:4px;text-decoration:none;margin-left:6px}"
        ".admin-link:hover{background:#f0f4f8;color:#0d3b66}"
        ".logs-link{font-size:13px;font-weight:normal;color:#0d6efd;border:1px solid #b6d4fe;"
        "padding:4px 12px;border-radius:4px;text-decoration:none;margin-left:6px}"
        ".logs-link:hover{background:#e8f4fd;color:#0a58ca}</style>"
        "<h2><span>QEngine Test Execution Dashboards</span>"
        "<span>"
        "<a class='logs-link' href='/logs'>&#128230; Uploaded Logs</a>"
        "<a class='admin-link' href='/admin'>&#9881; Admin</a>"
        "</span></h2>"
        "<table><thead><tr><th>Topic</th><th>Run ID</th><th>Result</th>"
        "<th>Generated</th><th></th></tr></thead><tbody>" + body + "</tbody></table>"
    )
    return html


@app.get("/latest")
def latest():
    """Redirect to the most recently generated dashboard."""
    runs = _list_runs()
    if not runs:
        return jsonify(status="error", message="No dashboards generated yet."), 404
    base = request.host_url.rstrip("/")
    return redirect(f"{base}/dashboards/{runs[0]['run']}/dashboard.html", code=302)


# ---------------------------------------------------------------------------
# Admin routes — protected by session login
# ---------------------------------------------------------------------------

@app.route("/admin/login", methods=["GET", "POST"])
def admin_login():
    """Admin login page."""
    error = ""
    if request.method == "POST":
        username = request.form.get("username", "")
        password = request.form.get("password", "")
        ph = hashlib.sha256(password.encode()).hexdigest()
        if (
            secrets.compare_digest(username, _ADMIN_USER)
            and secrets.compare_digest(ph, _ADMIN_PASS_HASH)
        ):
            session["admin"] = True
            next_url = request.args.get("next", url_for("admin_console"))
            # Only allow relative redirects to prevent open-redirect.
            if not next_url.startswith("/"):
                next_url = url_for("admin_console")
            return redirect(next_url)
        error = "Invalid username or password."
    err_html = f"<div class='err'>{error}</div>" if error else ""
    html = (
        "<!doctype html><meta charset='utf-8'><title>Admin Login \u2013 QEngine</title>"
        "<style>"
        "body{font-family:Segoe UI,Arial,sans-serif;background:#f0f4f8;display:flex;"
        "align-items:center;justify-content:center;min-height:100vh;margin:0}"
        ".card{background:#fff;border-radius:8px;box-shadow:0 2px 14px rgba(0,0,0,.13);"
        "padding:36px 40px;width:340px}"
        "h2{color:#0d3b66;margin:0 0 24px;font-size:20px}"
        "label{display:block;font-size:13px;color:#444;margin-bottom:4px}"
        "input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #ccc;"
        "border-radius:4px;font-size:14px;margin-bottom:16px;outline:none}"
        "input:focus{border-color:#0d3b66}"
        "button{width:100%;padding:10px;background:#0d3b66;color:#fff;border:none;"
        "border-radius:4px;font-size:15px;cursor:pointer}"
        "button:hover{background:#1a5276}"
        ".err{color:#dc3545;font-size:13px;margin-bottom:14px;padding:8px 10px;"
        "background:#fff0f0;border:1px solid #f5c6c6;border-radius:4px}"
        "</style>"
        "<div class='card'>"
        "<h2>&#128274; Admin Console</h2>"
        + err_html +
        "<form method='post'>"
        "<label>Username</label>"
        "<input name='username' autocomplete='username' required autofocus>"
        "<label>Password</label>"
        "<input name='password' type='password' autocomplete='current-password' required>"
        "<button type='submit'>Sign in</button>"
        "</form></div>"
    )
    return html


@app.get("/admin/logout")
def admin_logout():
    session.clear()
    return redirect(url_for("admin_login"))


@app.get("/admin")
@_admin_required
def admin_console():
    """Admin console \u2014 manage runs: delete, rename topic, open dashboards."""
    import time as _time

    base = request.host_url.rstrip("/")
    runs = _list_runs()
    rows = []
    for r in runs:
        when = _time.strftime("%d-%b-%Y %H:%M", _time.localtime(r["mtime"]))
        topic_safe = (r["topic"] or "").replace("'", "&#39;").replace('"', "&quot;")
        rows.append(
            f"<tr id='row-{r['run']}'>"
            f"<td>"
            f"  <span id='td-{r['run']}'>{r['topic'] or '<em style=color:#aaa>\u2014</em>'}</span>"
            f"  <span id='te-{r['run']}' style='display:none'>"
            f"    <input id='ti-{r['run']}' value='{topic_safe}' "
            f"      style='width:170px;padding:3px 6px;border:1px solid #aaa;border-radius:3px;font-size:13px'>"
            f"    <button onclick=\"saveRename('{r['run']}')\" class='btn-save'>Save</button>"
            f"    <button onclick=\"cancelRename('{r['run']}')\" class='btn-cancel'>Cancel</button>"
            f"  </span>"
            f"  <button onclick=\"editRename('{r['run']}')\" id='eb-{r['run']}' title='Edit topic' class='btn-edit'>&#9998;</button>"
            f"</td>"
            f"<td style='font-family:monospace;font-size:12px'>{r['run']}</td>"
            f"<td>{r['summary']}</td>"
            f"<td>{when}</td>"
            f"<td>"
            f"  <a href='{base}/dashboards/{r['run']}/dashboard.html' target='_blank'>Dashboard</a>"
            f"  &nbsp;&middot;&nbsp;"
            f"  <a href='{base}/dashboards/{r['run']}/dashboard.pdf' target='_blank'>PDF</a>"
            f"  &nbsp;&middot;&nbsp;"
            f"  <a href='{base}/dashboards/{r['run']}/report.json' target='_blank'>JSON</a>"
            f"</td>"
            f"<td>"
            f"  <button onclick=\"deleteRun('{r['run']}', this)\" class='btn-del'>Delete</button>"
            f"  <button onclick=\"patchLogs('{r['run']}', this)\" class='btn-patch ms-1'>Re-attach Logs</button>"
            f"</td>"
            f"</tr>"
        )
    body = "".join(rows) or "<tr><td colspan='6' style='text-align:center;color:#888;padding:20px'>No runs yet.</td></tr>"
    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<title>Admin Console \u2013 QEngine</title>"
        "<style>"
        "*{box-sizing:border-box}"
        "body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f0f4f8}"
        ".topbar{background:#0d3b66;color:#fff;padding:12px 28px;display:flex;"
        "  align-items:center;justify-content:space-between}"
        ".topbar h1{margin:0;font-size:19px;font-weight:600}"
        ".topbar a{color:#aed6f1;text-decoration:none;font-size:13px}"
        ".topbar a:hover{color:#fff}"
        ".content{padding:24px 28px}"
        ".stats{display:flex;gap:14px;margin-bottom:22px}"
        ".stat{background:#fff;border-radius:8px;padding:14px 20px;"
        "  box-shadow:0 1px 4px rgba(0,0,0,.08);min-width:110px}"
        ".stat .val{font-size:26px;font-weight:700;color:#0d3b66}"
        ".stat .lbl{font-size:11px;color:#888;margin-top:2px;text-transform:uppercase;letter-spacing:.5px}"
        "table{border-collapse:collapse;width:100%;background:#fff;border-radius:8px;"
        "  box-shadow:0 1px 4px rgba(0,0,0,.08)}"
        "th,td{border-bottom:1px solid #eaecf0;padding:9px 11px;text-align:left;font-size:13px}"
        "th{background:#0d3b66;color:#fff;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.4px}"
        "tr:last-child td{border-bottom:none}"
        "tr:hover td{background:#f8f9fb}"
        "a{color:#0d6efd;text-decoration:none}a:hover{text-decoration:underline}"
        ".section-title{font-size:15px;font-weight:600;color:#0d3b66;margin:0 0 10px}"
        ".btn-del{background:#dc3545;color:#fff;border:none;padding:4px 10px;"
        "  border-radius:4px;cursor:pointer;font-size:12px}"
        ".btn-del:hover{background:#b02a37}"
        ".btn-edit{background:none;border:none;cursor:pointer;font-size:15px;"
        "  color:#555;padding:0 4px;vertical-align:middle}"
        ".btn-edit:hover{color:#0d3b66}"
        ".btn-save{background:#198754;color:#fff;border:none;padding:3px 9px;"
        "  border-radius:3px;cursor:pointer;font-size:12px;margin-left:4px}"
        ".btn-cancel{background:#6c757d;color:#fff;border:none;padding:3px 9px;"
        "  border-radius:3px;cursor:pointer;font-size:12px;margin-left:3px}"
        ".btn-patch{background:#0d6efd;color:#fff;border:none;padding:4px 10px;"
        "  border-radius:4px;cursor:pointer;font-size:12px}"
        ".btn-patch:hover{background:#0a58ca}"
        ".ms-1{margin-left:4px}"
        "</style>"
        "<div class='topbar'>"
        "<h1>&#9881;&#65039; Admin Console</h1>"
        "<div>"
        "<span style='margin-right:20px;font-size:13px'>Signed in as <strong>prathosh</strong></span>"
        "<a href='/'>&#8592; Dashboard</a>"
        "&nbsp;&nbsp;"
        "<a href='/admin/logout'>Logout</a>"
        "</div></div>"
        "<div class='content'>"
        "<div class='stats'>"
        f"<div class='stat'><div class='val'>{len(runs)}</div><div class='lbl'>Total Runs</div></div>"
        f"<div class='stat'><div class='val'>{sum(1 for r in runs if r['summary'].startswith('0/') is False and r['summary'])}</div><div class='lbl'>With Results</div></div>"
        "</div>"
        "<p class='section-title'>Test Execution Runs</p>"
        "<table><thead><tr>"
        "<th>Topic</th><th>Run ID</th><th>Result</th><th>Generated</th><th>Links</th><th>Action</th>"
        "</tr></thead><tbody>" + body + "</tbody></table>"
        "</div>"
        "<script>"
        "function editRename(id){"
        "  document.getElementById('td-'+id).style.display='none';"
        "  document.getElementById('eb-'+id).style.display='none';"
        "  document.getElementById('te-'+id).style.display='inline';"
        "  document.getElementById('ti-'+id).focus();"
        "}"
        "function cancelRename(id){"
        "  document.getElementById('td-'+id).style.display='';"
        "  document.getElementById('eb-'+id).style.display='';"
        "  document.getElementById('te-'+id).style.display='none';"
        "}"
        "function saveRename(id){"
        "  const val=document.getElementById('ti-'+id).value.trim();"
        "  fetch('/admin/rename/'+id,{method:'POST',"
        "    headers:{'Content-Type':'application/json'},"
        "    body:JSON.stringify({topic:val})})"
        "  .then(r=>r.json()).then(d=>{"
        "    if(d.status==='ok'){"
        "      document.getElementById('td-'+id).textContent=val||'\u2014';"
        "      cancelRename(id);"
        "    } else { alert('Error: '+(d.message||'unknown')); }"
        "  }).catch(()=>alert('Request failed'));"
        "}"
        "function deleteRun(runId,btn){"
        "  if(!confirm('Delete run '+runId+' and all its files?\\nThis cannot be undone.')) return;"
        "  btn.disabled=true; btn.textContent='Deleting\u2026';"
        "  fetch('/admin/delete/'+runId,{method:'POST'})"
        "  .then(r=>r.json()).then(d=>{"
        "    if(d.status==='ok'){document.getElementById('row-'+runId).remove();}"
        "    else{alert('Error: '+(d.message||'unknown'));btn.disabled=false;btn.textContent='Delete';}"
        "  }).catch(()=>{alert('Request failed');btn.disabled=false;btn.textContent='Delete';});"
        "}"
        "function patchLogs(runId,btn){"
        "  btn.disabled=true; btn.textContent='Attaching\u2026';"
        "  fetch('/admin/patch-logs/'+runId,{method:'POST'})"
        "  .then(r=>r.json()).then(d=>{"
        "    if(d.status==='ok'){"
        "      btn.textContent='Done ('+d.total_logs+' logs)';"
        "      btn.style.background='#198754';"
        "      setTimeout(()=>location.reload(),1200);"
        "    } else {"
        "      alert('Error: '+(d.message||'unknown'));"
        "      btn.disabled=false; btn.textContent='Re-attach Logs';"
        "    }"
        "  }).catch(()=>{alert('Request failed');btn.disabled=false;btn.textContent='Re-attach Logs';});"
        "}"
        "</script>"
    )
    return html


@app.post("/admin/delete/<run_id>")
@_admin_required
def admin_delete_run(run_id: str):
    """Delete all generated files for a run (admin only)."""
    import re
    import shutil

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", run_id):
        return jsonify(status="error", message="Invalid run id."), 400
    target = OUTPUT_ROOT / run_id
    if not target.is_dir():
        return jsonify(status="error", message="Run not found."), 404
    if not target.resolve().is_relative_to(OUTPUT_ROOT.resolve()):
        return jsonify(status="error", message="Invalid run id."), 400
    shutil.rmtree(target)
    log.info("Admin deleted run: %s", run_id)
    return jsonify(status="ok", deleted=run_id)


@app.post("/admin/rename/<run_id>")
@_admin_required
def admin_rename_run(run_id: str):
    """Update topic_name for a run by patching its report.json in place."""
    import json as _json
    import re

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", run_id):
        return jsonify(status="error", message="Invalid run id."), 400
    target = OUTPUT_ROOT / run_id
    if not target.resolve().is_relative_to(OUTPUT_ROOT.resolve()):
        return jsonify(status="error", message="Invalid run id."), 400

    body = request.get_json(silent=True) or {}
    new_topic = str(body.get("topic", "")).strip()

    rj = target / "report.json"
    if not rj.is_file():
        return jsonify(status="error", message="report.json not found for this run."), 404
    try:
        data = _json.loads(rj.read_text(encoding="utf-8"))
        data.setdefault("summary", {})["topic_name"] = new_topic
        rj.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")
    except (OSError, ValueError) as exc:
        return jsonify(status="error", message=str(exc)), 500

    log.info("Admin renamed run %s topic \u2192 '%s'", run_id, new_topic)
    return jsonify(status="ok", run_id=run_id, topic=new_topic)


def _rebuild_report_from_json(data: dict):
    """Reconstruct a minimal ExecutionReport from a saved report.json dict.
    Enough to re-render the dashboard (charts + logs section) without an API call.
    """
    from .models import (
        ExecutionReport, ExecutionSummary, TestCaseResult,
        Status, FailureDetail, RerunInfo,
    )
    s = data.get("summary", {})
    reruns = [
        RerunInfo(
            iteration=r.get("iteration", 1),
            started_time=r.get("started_time", ""),
            terminated_time=r.get("terminated_time", ""),
            total_cases=r.get("total_cases", 0),
            passed_cases=r.get("passed_cases", 0),
            failed_cases=r.get("failed_cases", 0),
            status=r.get("status", ""),
        )
        for r in s.get("reruns", [])
    ]
    summary = ExecutionSummary(
        topic_name=s.get("topic_name", ""),
        project_name=s.get("project_name", ""),
        test_plan_name=s.get("test_plan_name", ""),
        test_suite_name=s.get("test_suite_name", ""),
        test_run_id=s.get("test_run_id", ""),
        build_number=s.get("build_number", ""),
        started_time=s.get("started_time", ""),
        end_time=s.get("end_time", ""),
        total_duration=s.get("total_duration", ""),
        environment=s.get("environment", ""),
        executed_by=s.get("executed_by", ""),
        execution_status=s.get("execution_status", ""),
        total_cases=s.get("total_cases", 0),
        passed=s.get("passed", 0),
        failed=s.get("failed", 0),
        skipped=s.get("skipped", 0),
        reruns=reruns,
    )
    cases = []
    for i, c in enumerate(data.get("cases", []), 1):
        fd = None
        if c.get("failure"):
            f = c["failure"]
            fd = FailureDetail(
                error_message=f.get("error_message", ""),
                exception_type=f.get("exception_type", ""),
                stack_trace=f.get("stack_trace", ""),
                assertion_failure=f.get("assertion_failure", ""),
                screenshots=f.get("screenshots") or [],
            )
        cases.append(TestCaseResult(
            s_no=c.get("s_no", i),
            name=c.get("name", ""),
            status=Status.from_raw(c.get("status")),
            duration_ms=c.get("duration_ms", 0),
            suite=c.get("suite", ""),
            module=c.get("module", ""),
            started_time=c.get("started_time", ""),
            end_time=c.get("end_time", ""),
            failure=fd,
            local_screenshots=c.get("local_screenshots") or [],
        ))
    return ExecutionReport(
        summary=summary,
        cases=cases,
        source=data.get("source", "cached"),
        generated_at=data.get("generated_at", ""),
    )


@app.post("/admin/patch-logs/<run_id>")
@_admin_required
def admin_patch_logs(run_id: str):
    """Re-attach uploaded log zips to an existing dashboard (no API call).

    Scans LOG_ROOT for folders matching this run's topic / plan name,
    appends the log artifacts, re-renders dashboard.html and updates report.json.
    """
    import json as _json
    import re
    from urllib.parse import quote

    from .artifacts import LogArtifact, parse_log_name
    from .charts import ChartFactory
    from .config import safe_name
    from .dashboard import DashboardBuilder

    if not re.fullmatch(r"[A-Za-z0-9_\-]+", run_id):
        return jsonify(status="error", message="Invalid run id."), 400
    run_dir = OUTPUT_ROOT / run_id
    if not run_dir.resolve().is_relative_to(OUTPUT_ROOT.resolve()):
        return jsonify(status="error", message="Invalid run id."), 400
    rj = run_dir / "report.json"
    if not rj.is_file():
        return jsonify(status="error", message="report.json not found for this run."), 404

    data = _json.loads(rj.read_text(encoding="utf-8"))
    report = _rebuild_report_from_json(data)

    # Candidate folder names: topic_name + test_plan_name (fuzzy, case-insensitive).
    candidates: list[str] = []
    for raw in (report.summary.topic_name, report.summary.test_plan_name):
        key = safe_name((raw or "").strip())
        if key and key not in candidates:
            candidates.append(key)

    if not candidates:
        return jsonify(status="error", message="No topic or plan name in report.json to match logs against."), 400

    added = 0
    matched_folders: list[str] = []
    if LOG_ROOT.is_dir():
        for sub in sorted(LOG_ROOT.iterdir()):
            if not sub.is_dir():
                continue
            sub_key = sub.name.lower()
            matched = any(sub_key == c.lower() for c in candidates)
            if not matched:
                for p in list(sub.glob("*.zip")) + list(sub.glob("*.7z")):
                    fname_l = p.name.lower()
                    if any(
                        fname_l.startswith(c.lower() + "_") or fname_l.startswith(c.lower() + ".")
                        for c in candidates
                    ):
                        matched = True
                        break
            if not matched:
                continue
            matched_folders.append(sub.name)
            base_url = f"{request.host_url.rstrip('/')}/uploads/{sub.name}"
            existing = {a.name.lower() for a in report.log_artifacts}
            for p in sorted(sub.glob("*.zip")) + sorted(sub.glob("*.7z")):
                if p.name.lower() in existing:
                    continue
                url = base_url.rstrip("/") + "/" + quote(p.name)
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

    if not report.log_artifacts:
        return jsonify(
            status="error",
            message=f"No log folders matched candidates {candidates} in {LOG_ROOT}",
        ), 404

    # Re-render dashboard.html with the now-populated log artifacts.
    charts = ChartFactory(report, with_images=False).build_all()
    DashboardBuilder(report, charts, self_contained=True).save(run_dir)

    # Persist log artifacts back into report.json so future re-opens still show them.
    data.setdefault("artifacts", {})["logs"] = [
        {
            "name": a.name, "size_bytes": a.size_bytes,
            "machine": a.machine, "protocol": a.protocol,
            "kind": a.kind, "download_url": a.download_url,
        }
        for a in report.log_artifacts
    ]
    rj.write_text(_json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

    log.info(
        "Patched logs for run %s: added %d archive(s) from %s.",
        run_id, added, matched_folders,
    )
    return jsonify(
        status="ok",
        run_id=run_id,
        matched_folders=matched_folders,
        added=added,
        total_logs=len(report.log_artifacts),
    )


@app.route("/execute", methods=["GET", "POST"])
def execute():
    return _run_execute(
        run_id=_param("run_id"),
        env_id=_param("env_id"),
        project_id=_param("project_id", DEFAULT_PROJECT_ID),
        testplan_id=_param("testplan_id"),
        topic=_param("topic"),
        result_url=_param("result_url"),
        want_html_redirect=(_param("format") == "html"),
    )


def _run_execute(
    run_id="", env_id="", project_id="", testplan_id="", topic="",
    result_url="", want_html_redirect=False,
):
    """Shared generation path for /execute and /webhook."""
    goat_home = os.environ.get("GOAT_HOME", "")
    run_key = run_id or env_id or topic or "latest"
    out_dir = OUTPUT_ROOT / _safe(run_key)

    cfg = Config(
        result_url=result_url,
        project_id=project_id or DEFAULT_PROJECT_ID,
        run_id=run_id,
        env_id=env_id,
        testplan_id=testplan_id,
        topic=topic,
        goat_home=goat_home,
        output=str(out_dir),
        self_contained=True,  # served links must render even without the Plotly CDN
    )
    # Link uploaded logs by the RESOLVED topic (handles the webhook case where
    # the topic isn't passed — generate() fills it from the run, then matches).
    cfg.uploads_root = str(LOG_ROOT)
    cfg.uploads_base_url_root = f"{request.host_url.rstrip('/')}/uploads"
    if goat_home:
        cfg.goat_enabled = True
    cfg.make_pdf = False  # fast HTML now; PDF in the background

    log.info("Generate: run_id=%s env_id=%s topic=%s", run_id, env_id, topic)
    try:
        report = generate(cfg, fetch_all=False, log=log)
        _spawn_background_pdf(cfg)
    except (ConfigError, AuthError, QEngineError) as exc:
        log.error("Generation failed: %s", exc)
        return jsonify(status="error", message=str(exc)), 400
    except Exception as exc:  # pragma: no cover
        log.exception("Unexpected generation error")
        return jsonify(status="error", message=str(exc)), 500

    s = report.summary
    key = _safe(run_key)
    base = request.host_url.rstrip("/")
    payload = {
        "status": "ok",
        "topic": s.topic_name,
        "test_run_id": s.test_run_id,
        "total": s.total_cases,
        "passed": s.passed,
        "failed": s.failed,
        "skipped": s.skipped,
        "pass_percentage": s.pass_percentage,
        "conclusion": report.conclusion(),
        "run_key": key,
        "dashboard_url": f"{base}/dashboards/{key}/dashboard.html",
        "pdf_url": f"{base}/dashboards/{key}/dashboard.pdf",
        "json_url": f"{base}/dashboards/{key}/report.json",
        "dashboard_path": str(out_dir / "dashboard.html"),
        "pdf_path": str(out_dir / "dashboard.pdf"),
        "output_dir": str(out_dir),
    }
    if want_html_redirect:
        from flask import redirect

        return redirect(payload["dashboard_url"], code=302)
    return jsonify(payload)


@app.route("/webhook", methods=["GET", "POST"])
def webhook():
    """QEngine completion-webhook receiver.

    QEngine fires this when a Test Plan finishes (incl. reruns) and substitutes
    its macros. We extract the run id / env id / topic from whatever it sends —
    query params, a JSON body, or a ``Result`` param holding a JSON string —
    then generate the dashboard. Point your webhook's URL to:

        http://<host>:8089/webhook?run_id=<EXECUTION_ID_MACRO>&topic=<VARIABLES_MACRO>

    (use whatever macros QEngine exposes for the execution id and variables).
    If you can only pass the whole result JSON, send it and we'll dig the id out.
    """
    ctx = _gather_webhook_context()
    if not (ctx.get("run_id") or ctx.get("env_id")):
        # Couldn't find an id — echo what we received so the mapping can be fixed.
        log.warning("Webhook received but no run/env id found. Keys seen: %s", list(ctx.keys()))
        return jsonify(
            status="error",
            message="No run_id/env_id found in the webhook. Add a URL param "
                    "run_id=<execution id macro> (and topic=<variables macro>).",
            received=ctx,
        ), 400
    return _run_execute(
        run_id=ctx.get("run_id", ""),
        env_id=ctx.get("env_id", ""),
        project_id=ctx.get("project_id", "") or DEFAULT_PROJECT_ID,
        testplan_id=ctx.get("testplan_id", ""),
        topic=ctx.get("topic", ""),
        want_html_redirect=False,
    )


def _gather_webhook_context() -> dict:
    """Pull run/env/topic/plan from query, JSON body, or a nested Result JSON.

    Deep-searches all scalar key/values (including nested objects/lists and any
    ``Result``/``result`` field that holds a JSON string), so the ids are found
    wherever QEngine places them.
    """
    import json as _json

    flat: dict[str, str] = {}

    def absorb(obj) -> None:
        """Recursively collect scalar key→value pairs; parse JSON strings."""
        if isinstance(obj, dict):
            for k, v in obj.items():
                if isinstance(v, (dict, list)):
                    absorb(v)
                else:
                    flat.setdefault(k.lower(), v)
                    if isinstance(v, str) and v.strip().startswith(("{", "[")):
                        try:
                            absorb(_json.loads(v))
                        except ValueError:
                            pass
        elif isinstance(obj, list):
            for item in obj:
                absorb(item)

    absorb({k: v for k, v in request.values.items()})  # query + form
    absorb(request.get_json(silent=True))               # JSON body

    def pick(*names: str) -> str:
        for n in names:
            v = flat.get(n)
            if v not in (None, "", "<RESULT>") and not str(v).startswith("<"):
                return str(v)
        return ""

    return {
        "run_id": pick("run_id", "scheduleexecutions_id", "execution_id", "executionid"),
        "env_id": pick("env_id", "executedenvironment_id", "executedenvironmentid"),
        "project_id": pick("project_id", "projectid"),
        "testplan_id": pick("testplan_id", "schedule_id", "scheduleid"),
        # Prefer explicit $Topic variable; fall back to testplan_name from the payload.
        "topic": pick("topic", "environmentvariables_name", "variablesname", "variables", "testplan_name"),
        "_seen_keys": ",".join(sorted(flat.keys()))[:500],  # helps debugging mapping
    }


@app.route("/upload", methods=["POST"])
def upload():
    """Upload a log zip for a topic (called by the upload-logs test case).

    Send the file as multipart form-data (field name ``file``) OR as the raw
    request body with ``?filename=<name>``. Always include ``?topic=<Topic>``.
    Stored under DASHBOARD_LOG_ROOT/<topic>/ and linked from that topic's dashboard.
    """
    topic = _param("topic")
    if not topic:
        return jsonify(status="error", message="topic is required"), 400
    dest_dir = LOG_ROOT / _safe(topic)
    dest_dir.mkdir(parents=True, exist_ok=True)

    # Reject oversize early (before transferring) using the declared length.
    clen = request.content_length or 0
    if clen and clen > _MAX_UPLOAD_MB * 1024 * 1024:
        return jsonify(
            status="error",
            message=f"file is {clen // (1024*1024)} MB; limit is {_MAX_UPLOAD_MB} MB",
        ), 413

    # Stream straight to disk — never load the whole (possibly 100s of MB) file
    # into memory. Multipart uses werkzeug's streaming save; raw body is chunked.
    filename = ""
    written = 0
    if "file" in request.files:
        f = request.files["file"]
        filename = _safe(os.path.basename(f.filename or _param("filename")))
        if not filename:
            return jsonify(status="error", message="filename missing"), 400
        dest = dest_dir / filename
        f.save(str(dest))
        written = dest.stat().st_size if dest.is_file() else 0
    else:
        filename = _safe(os.path.basename(_param("filename")))
        if not filename:
            return jsonify(status="error", message="filename missing"), 400
        dest = dest_dir / filename
        with open(dest, "wb") as out:
            while True:
                chunk = request.stream.read(4 * 1024 * 1024)  # 4 MB chunks
                if not chunk:
                    break
                out.write(chunk)
                written += len(chunk)

    if not written:
        return jsonify(status="error", message="empty body"), 400

    base = request.host_url.rstrip("/")
    log.info("Uploaded log %s (%.1f MB) for topic '%s'", filename, written / 1048576, topic)
    return jsonify(
        status="ok",
        topic=topic,
        filename=filename,
        size=written,
        url=f"{base}/uploads/{_safe(topic)}/{filename}",
    )


@app.get("/uploads/<topic>/<path:filename>")
def serve_upload(topic: str, filename: str):
    directory = LOG_ROOT / _safe(topic)
    if not (directory / filename).is_file():
        return jsonify(status="error", message="Not found"), 404
    return send_from_directory(str(directory), filename, as_attachment=True)


@app.get("/dashboards/<run>/<path:filename>")
def serve_dashboard(run: str, filename: str):
    directory = OUTPUT_ROOT / _safe(run)
    if not (directory / filename).is_file():
        return jsonify(status="error", message="Not found"), 404
    return send_from_directory(str(directory), filename)


def _spawn_background_pdf(cfg) -> None:
    """Generate just the PDF in a daemon thread (kaleido + Chrome are slow)."""
    pdf_cfg = copy.copy(cfg)
    pdf_cfg.make_html = pdf_cfg.make_json = pdf_cfg.make_csv = pdf_cfg.make_xlsx = False
    pdf_cfg.make_pdf = True

    def _run():
        try:
            generate(pdf_cfg, fetch_all=False, log=log)
            log.info("Background PDF ready for %s", pdf_cfg.output)
        except Exception as exc:  # pragma: no cover
            log.warning("Background PDF generation failed: %s", exc)

    threading.Thread(target=_run, daemon=True).start()


# ---------------------------------------------------------------------------
# Logs browser — shows all uploaded zips grouped by topic / machine
# ---------------------------------------------------------------------------

def _fmt_size(num: int) -> str:
    """Human-readable file size."""
    size = float(num)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:.1f} {unit}" if unit != "B" else f"{int(size)} B"
        size /= 1024
    return f"{size:.1f} GB"


@app.get("/logs")
def logs_index():
    """Uploaded-logs browser: all topics → machines → Agent / DS zips."""
    from .artifacts import parse_log_name

    base = request.host_url.rstrip("/")
    topic_blocks = []
    if LOG_ROOT.is_dir():
        for topic_dir in sorted(LOG_ROOT.iterdir()):
            if not topic_dir.is_dir():
                continue
            topic_name = topic_dir.name
            zips = sorted(list(topic_dir.glob("*.zip")) + list(topic_dir.glob("*.7z")))
            if not zips:
                continue
            # Group by (machine, protocol)
            rows: dict[tuple, dict] = {}
            for p in zips:
                kind, machine, protocol = parse_log_name(p.name)
                key = (machine or "unknown", protocol or "")
                row = rows.setdefault(
                    key,
                    {"machine": machine or "unknown", "protocol": protocol, "agent": None, "ds": None},
                )
                info = {
                    "name": p.name,
                    "size": _fmt_size(p.stat().st_size),
                    "url": f"{base}/uploads/{topic_name}/{p.name}",
                }
                if kind == "DS":
                    row["ds"] = info
                else:
                    row["agent"] = info
            sorted_rows = sorted(rows.values(), key=lambda r: (r["machine"], r["protocol"]))
            topic_blocks.append(
                {"name": topic_name, "rows": sorted_rows, "total": len(zips)}
            )

    # ── render ──────────────────────────────────────────────────────────────
    topic_html_parts = []
    for tb in topic_blocks:
        trs = []
        for r in tb["rows"]:
            a = r["agent"]
            d = r["ds"]
            agent_td = (
                f"<a href='{a['url']}' class='log-btn agent-btn' download>"
                f"<i class='bi bi-download'></i> {a['name']}"
                f"<span class='log-size'>({a['size']})</span></a>"
                if a else "<span class='no-log'>—</span>"
            )
            ds_td = (
                f"<a href='{d['url']}' class='log-btn ds-btn' download>"
                f"<i class='bi bi-download'></i> {d['name']}"
                f"<span class='log-size'>({d['size']})</span></a>"
                if d else "<span class='no-log'>No DS logs</span>"
            )
            proto_td = (
                f"<span class='proto-chip'>{r['protocol']}</span>"
                if r["protocol"] else "—"
            )
            trs.append(
                f"<tr><td class='machine-cell'>{r['machine']}</td>"
                f"<td>{proto_td}</td>"
                f"<td>{agent_td}</td>"
                f"<td>{ds_td}</td></tr>"
            )
        tbody = "".join(trs) or "<tr><td colspan='4' class='empty-row'>No log files found.</td></tr>"
        topic_html_parts.append(
            f"<div class='topic-block'>"
            f"<div class='topic-header'>"
            f"<i class='bi bi-folder2-open'></i> {tb['name']}"
            f"<span class='topic-count'>{tb['total']} file{'s' if tb['total'] != 1 else ''}</span>"
            f"</div>"
            f"<div class='table-wrap'>"
            f"<table><thead><tr>"
            f"<th><i class='bi bi-pc-display'></i> Machine</th>"
            f"<th>Protocol</th>"
            f"<th><i class='bi bi-file-earmark-zip'></i> Agent Logs</th>"
            f"<th><i class='bi bi-hdd-network'></i> DS Logs</th>"
            f"</tr></thead><tbody>{tbody}</tbody></table>"
            f"</div></div>"
        )

    body_html = "".join(topic_html_parts) if topic_html_parts else (
        "<div class='empty-state'><i class='bi bi-inbox' style='font-size:3rem;color:#ccc'></i>"
        "<p>No log archives uploaded yet.</p>"
        "<p class='text-muted'>Upload logs via <code>POST /upload?topic=&lt;TopicName&gt;</code></p></div>"
    )

    html = (
        "<!doctype html><meta charset='utf-8'>"
        "<title>Uploaded Logs — QEngine</title>"
        "<link href='https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css' rel='stylesheet'>"
        "<style>"
        "*{box-sizing:border-box}"
        "body{font-family:Segoe UI,Arial,sans-serif;margin:0;background:#f0f4f8}"
        ".topbar{background:#0d3b66;color:#fff;padding:12px 28px;"
        "  display:flex;align-items:center;justify-content:space-between}"
        ".topbar h1{margin:0;font-size:19px;font-weight:600}"
        ".topbar a{color:#aed6f1;text-decoration:none;font-size:13px}"
        ".topbar a:hover{color:#fff}"
        ".content{padding:24px 28px;max-width:1200px}"
        ".topic-block{background:#fff;border-radius:8px;box-shadow:0 1px 4px rgba(0,0,0,.08);"
        "  margin-bottom:20px;overflow:hidden}"
        ".topic-header{background:#0d3b66;color:#fff;padding:10px 16px;font-size:15px;"
        "  font-weight:600;display:flex;align-items:center;justify-content:space-between}"
        ".topic-header i{margin-right:8px}"
        ".topic-count{font-size:12px;font-weight:400;opacity:.8;background:rgba(255,255,255,.15);"
        "  padding:2px 10px;border-radius:10px}"
        ".table-wrap{overflow-x:auto}"
        "table{border-collapse:collapse;width:100%}"
        "th,td{border-bottom:1px solid #eaecf0;padding:9px 14px;text-align:left;font-size:13px}"
        "th{background:#f6f8fa;color:#444;font-weight:600;font-size:12px;"
        "  text-transform:uppercase;letter-spacing:.4px}"
        "tr:last-child td{border-bottom:none}"
        "tr:hover td{background:#f8f9fb}"
        ".machine-cell{font-weight:600;font-family:monospace;font-size:12px;color:#0d3b66}"
        ".proto-chip{display:inline-block;background:#e8f4fd;color:#0d6efd;padding:2px 8px;"
        "  border-radius:10px;font-size:11px;font-weight:600}"
        ".log-btn{display:inline-flex;align-items:center;gap:5px;padding:4px 12px;"
        "  border-radius:5px;font-size:12px;font-weight:500;text-decoration:none;"
        "  border:1px solid;white-space:nowrap}"
        ".agent-btn{background:#eaf4ee;color:#198754;border-color:#b8dfc8}"
        ".agent-btn:hover{background:#d1ead9}"
        ".ds-btn{background:#e8f4fd;color:#0d6efd;border-color:#b6d4fe}"
        ".ds-btn:hover{background:#d0e8fb}"
        ".log-size{color:#888;font-weight:400;margin-left:2px}"
        ".no-log{color:#aaa;font-size:12px}"
        ".empty-row{text-align:center;color:#888;padding:16px}"
        ".empty-state{text-align:center;padding:60px 20px;color:#888}"
        ".empty-state p{margin:8px 0}"
        "</style>"
        "<div class='topbar'>"
        "<h1><i class='bi bi-archive-fill'></i>&nbsp; Uploaded Logs</h1>"
        "<div>"
        "<a href='/'>&#8592; Dashboards</a>"
        "&nbsp;&nbsp;<a href='/admin'>Admin</a>"
        "</div></div>"
        "<div class='content'>"
        + body_html +
        "</div>"
    )
    return html




def main() -> None:
    port = int(os.environ.get("DASHBOARD_PORT", "8089"))
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    log.info("QEngine dashboard service on http://0.0.0.0:%d  (outputs → %s)", port, OUTPUT_ROOT)
    try:
        from waitress import serve  # production WSGI server

        log.info("Serving with waitress (threads=8, max body 2 GB).")
        serve(
            app, host="0.0.0.0", port=port, threads=8,
            max_request_body_size=2 * 1024 * 1024 * 1024,  # 2 GB uploads
            channel_timeout=1200,  # allow slow large uploads
        )
    except ImportError:
        log.warning("waitress not installed — using Flask dev server. `pip install waitress`.")
        app.run(host="0.0.0.0", port=port, threaded=True)


if __name__ == "__main__":
    main()
