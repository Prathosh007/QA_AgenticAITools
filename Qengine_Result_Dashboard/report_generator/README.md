# QEngine Test Run Dashboard & Automation Report Generator

A production-grade Python tool that, after a QEngine Test Plan finishes, retrieves
the execution result and generates:

- **`dashboard.html`** — interactive Bootstrap 5 + Plotly dashboard
- **`dashboard.pdf`** — professional, print-ready Automation Test Execution Report
- **`report.json`** — full normalised summary
- **`execution.csv`** / **`execution.xlsx`** — tabular exports

It auto-selects the best available data source:

1. **Official OAuth REST API** *(preferred)*
2. **Browser-cookie internal API** *(fallback)*
3. **Offline HAR capture** *(testing / air-gapped)*

---

## 1. Quick start

```bash
pip install -r requirements.txt

# One-time: set OAuth credentials (Zoho refresh-token flow) in .env
cp .env.example .env   # then fill CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN

# Recommended — by run id (resolves env id + Topic + test plan + reruns, OAuth only):
python main.py --run-id 4443000074661121 --output ./Reports

# Or by executedenvironment_id directly:
python main.py --project-id 4443000000022861 --env-id 4443000074661122 --output ./Reports

# Or from a result URL (fills project-id + env-id):
python main.py --result-url "https://qengine.zoho.in/uems/projects/<pid>/results/<envId>" --output ./Reports

# Offline demo against a captured HAR (no network):
python main.py --har Agent_Prelims.har --output ./output
```

**Auth is OAuth-only** — the tool reads `CLIENT_ID`, `CLIENT_SECRET`,
`REFRESH_TOKEN` from `.env` and manages the access token (refresh + cache) via
[auth.py](auth.py). No browser cookies.

### CLI options

| Flag | Description |
|------|-------------|
| `--run-id` | `scheduleexecutions_id` — resolves env id + Topic + test plan + reruns (OAuth, recommended). |
| `--env-id` | `executedenvironment_id` (alternative to `--run-id`). |
| `--project-id` | QEngine project id (or `PROJECT_ID` in `.env`). |
| `--testplan-id` | Test plan id (optional — auto-derived from the run's `schedule_id`). |
| `--result-url` | QEngine Result URL (fills project-id + env-id). |
| `--topic` | Topic name (overrides; scopes GOAT log collection). |
| `--host` | QEngine host (default `https://qengine.zoho.in`). |
| `--har` | Path to a captured `.har` (offline source). |
| `--output` | Output folder (default `./output`). |
| `--config` | YAML config file (see `config.example.yaml`). |
| `--all-details` | Fetch per-case detail for *every* case (default: failed only). |
| `-v/--verbose` | Debug logging. |

### Execute-URL service (single action)

Run the HTTP service once; the QEngine final test case then hits **one URL**:

```bash
python -m report_generator.server         # listens on :8089
curl -X POST "http://<host>:8089/execute?project_id=<pid>&env_id=<envId>&testplan_id=<tpid>&topic=<Topic>&goat_home=D:\GOAT"
# → { "status":"ok", "dashboard_url":"/dashboards/<env>/dashboard.html", ... }
```

The QEngine test case that calls this is in
[qengine_generate_dashboard.js](qengine_generate_dashboard.js). Endpoints:
`GET /health`, `GET/POST /execute`, `GET /dashboards/<run>/<file>`.

---

## 1b. GOAT integration (single-action dashboard)

The tool can run **on the GOAT server** as the final test case of a plan and
merge GOAT's local execution data with QEngine results:

```bash
# Merge mode (recommended): QEngine (OAuth) authoritative + GOAT remarks/logs/screenshots
python main.py --project-id <pid> --env-id <envId> --topic "<Topic>" --goat-home "D:\GOAT" --output ./out

# GOAT-only mode: no QEngine auth, build everything from local test_status
python main.py --goat-home "D:\GOAT" --test-id "<run>" --topic "<Topic>" --output ./out
```

It adds: per-case **Error Remarks** from GOAT `test_status.json`, a **Logs &
Artifacts** section (Agent/DS log zips collected into `UploadFiles`, linked via
`/api/files/download`), **failure screenshots** embedded inline, and a **GOAT
Step Remarks** appendix for component steps not mapped 1:1 to a QEngine case.

GOAT flags: `--goat-home`, `--goat-url`, `--test-id`, `--test-status-root`,
`--upload-dir`, `--publish-via-api`. See **[INTEGRATION.md](INTEGRATION.md)**
for the full wiring (final test-case payload + the per-machine upload step).

## 2. Architecture

```
main.py / server.py  ──► generate(config)
   └── QEngineService (api.py) ── picks source ──┐
        ├── OAuthClient (clients/oauth_client.py)  v1 API, Authorization: Zoho-oauthtoken
        │                                          token via auth.py (.env refresh-token flow)
        └── HarClient   (clients/har_client.py)    offline replay
                       ▼
        Raw payloads ──► ResultParser (parser.py) ──► models.py
                                                       (ExecutionSummary, TestCaseResult, FailureDetail)
                       │  + GOAT merge (goat.py, artifacts.py, merge.py)
                       ▼
                  ChartFactory · DashboardBuilder · ReportBuilder (PDF via pdf_engine.py)
                       ▼
                output/{dashboard.html, dashboard.pdf, report.json, execution.csv, execution.xlsx}
```

PDF rendering tries **WeasyPrint → headless Chrome/Edge → printable HTML** so it
works out of the box on Windows (where WeasyPrint's GTK dependency usually fails).

---

## 3. Official v1 API (OAuth)

Auth: `Authorization: Zoho-oauthtoken <token>` (token from the refresh-token flow
in `.env`). All endpoints under `https://qengine.zoho.in/api/v1/uems/projects/{project_id}`.
Successful reads return HTTP **202**.

| Key | Endpoint | Provides | Dashboard fields |
|-----|----------|----------|------------------|
| A | `GET /testcaseresult?executedenvironment_id={env}&startIndex={n}` | paged case list; each case nests `executedenvironment` (browser/os/version/resolution/framework) | Per-case table, environment, counts, suites, build, derived timing |
| B | `GET /testcaseresult/{case_result_id}` *(no extra params)* | case detail + `testcaseresult_datadriven[]` | Data-driven breakdown |
| C | `GET /testcaseresult/{child_id}` *(no extra params)* | `error_trace[]`, `error_message{}`, `exception_type`, `statementresult[]` (screenshot URLs), `browser_log[]` | Failure analysis, screenshots |
| D | `GET /testplans/{testplan_id}` | `name`, `testsuite[]`, `addedUser` | Plan name, users |
| E | `GET /scheduleexecutions/{run_id}` | `executed_environments[]` (env ids + **rerunDetails**), `environmentvariables_name` (**Topic**), `schedule_id` (test plan), counts/times | env-id resolution, Topic, Run/Re-Run table |

### Key facts (validated against the live API)
- Pass the **`run_id` (scheduleexecutions_id)** and endpoint **E** resolves
  everything: the env id (the case list lives on the rerun *iteration* env, not
  the root), the Topic, the test plan, and the rerun breakdown — all over OAuth.
- There is **no public list/search endpoint** — you supply the `run_id` (or
  `env_id`). The QEngine final test case has `@scheduleexecutions_id` in context.
- Detail calls reject extra query params (`400`); failure data lives on the
  **failed child component** (endpoint C).
- No `getStats`/`executedenvironments` in v1 → counts/environment/timing are
  **derived from the case list**; Topic/reruns come from **E**, plan name from **D**.

---

## 4. Field → source mapping

| Dashboard field | Source |
|-----------------|--------|
| Topic | D `variablesName` |
| Test Plan / Executed By | D `name` / `addedUser` |
| Test Suite(s) | A `suite_name` (de-duplicated) |
| Test Run ID | `scheduleexecutions_id` (from detail) → else env id |
| Build Number | A `codeversion_id` |
| Environment | A nested `executedenvironment` (browser, version, OS, resolution, framework) |
| Start / End / Duration | derived from A `added_time` + `duration` |
| Passed / Failed / Skipped / % | counted from A |
| Per-case row | A |
| Failure reason / trace / exception / screenshot / browser logs | B + C |
| Error Remarks (full execution log) | GOAT `test_status.json` (merge) |
| Log archives / failure screenshots | GOAT staging + screenshot dirs (merge) |

---

## 5. Error handling

Handled explicitly: invalid/expired OAuth token (401/403 → `AuthError`),
network timeout (retry + backoff), HTTP 429 rate-limit (backoff + retry),
client 4xx surfaced with the API message, empty test run, missing error
remarks / screenshots (graceful blanks), non-JSON responses, and missing
optional endpoints (swallowed with warnings).

---

## 6. Project layout

```
report_generator/
├── main.py            CLI entry point
├── api.py             data-acquisition orchestrator (source auto-select)
├── config.py          CLI + YAML config, result-URL parsing
├── models.py          normalised dataclasses + Status enum
├── parser.py          raw payloads → models
├── charts.py          Plotly charts (interactive HTML + PNG for PDF)
├── dashboard.py       Jinja2 Bootstrap dashboard renderer
├── report.py          PDF / JSON / CSV / XLSX generation
├── pdf_engine.py      WeasyPrint → Chromium → HTML fallback
├── logging_setup.py   coloured progress logging
├── clients/
│   ├── base.py        retry/backoff + endpoint definitions
│   ├── oauth_client.py
│   ├── cookie_client.py
│   └── har_client.py
├── templates/         dashboard.html.j2, report.html.j2
├── static/            dashboard.css
└── output/            generated artefacts
```
