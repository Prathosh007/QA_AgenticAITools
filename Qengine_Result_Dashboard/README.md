# QEngine Result Dashboard

A self-hosted web service that automatically generates interactive test execution dashboards from QEngine Test Plan results.  
Triggered by a webhook when a run completes — no manual steps required.

---

## Table of Contents

1. [What it does](#1-what-it-does)
2. [Architecture](#2-architecture)
3. [Setup & Installation](#3-setup--installation)
4. [Starting the server](#4-starting-the-server)
5. [Webhook configuration (QEngine)](#5-webhook-configuration-qengine)
6. [Public Dashboard page](#6-public-dashboard-page)
7. [Admin Console](#7-admin-console)
8. [CLI usage](#8-cli-usage)
9. [API reference](#9-api-reference)
10. [Topic name — how it is resolved](#10-topic-name--how-it-is-resolved)
11. [Output files](#11-output-files)
12. [Configuration reference](#12-configuration-reference)
13. [Running as a Windows Service](#13-running-as-a-windows-service)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. What it does

When a QEngine Test Plan finishes, it fires a webhook to this service.  
The service then:

1. Fetches the full run result from the QEngine REST API (OAuth)
2. Parses all test cases, timings, failure details, rerun iterations
3. Generates:
   - `dashboard.html` — interactive Bootstrap 5 + Plotly dashboard
   - `dashboard.pdf` — printable Automation Test Execution Report
   - `report.json` — normalised full summary
   - `execution.csv` — flat tabular export
4. Serves all files immediately at a stable URL
5. Shows the run in the public dashboard listing

---

## 2. Architecture

```
QEngine (cloud)
    │  fires webhook on run completion
    ▼
report_generator/server.py   (Flask + Waitress, port 8089)
    │  calls QEngine REST API over OAuth
    │  parses result via parser.py
    │  renders via dashboard.py (Jinja2) + charts.py (Plotly)
    ▼
output/runs/<run_id>/
    ├── dashboard.html
    ├── dashboard.pdf
    ├── report.json
    └── execution.csv
```

---

## 3. Setup & Installation

### Prerequisites
- Python 3.10+
- QEngine OAuth credentials (Client ID, Client Secret, Refresh Token)

### Install

```powershell
cd D:\Qengine_Result_Dashboard
pip install -r report_generator\requirements.txt
```

### Configure credentials

Copy the example env file and fill in your OAuth details:

```powershell
copy report_generator\.env.example report_generator\.env
```

Edit `report_generator\.env`:

```
CLIENT_ID=<your Zoho OAuth client id>
CLIENT_SECRET=<your Zoho OAuth client secret>
REFRESH_TOKEN=<your Zoho OAuth refresh token>
PROJECT_ID=<your QEngine project id, e.g. 4443000000022861>
```

Verify the token works:

```powershell
cd D:\Qengine_Result_Dashboard
python -c "import sys; sys.path.insert(0,'report_generator'); from auth import get_access_token; print('OK, token length:', len(get_access_token()))"
```

---

## 4. Starting the server

```powershell
cd D:\Qengine_Result_Dashboard
python -m report_generator.server
```

Default port: **8089**  
Override: set `DASHBOARD_PORT` environment variable.

The server URL will be: `http://<hostname>:8089`  
Example: `http://prathosh-14802-t:8089`

To run it persistently, install it as a Windows Scheduled Task (see [section 13](#13-running-as-a-windows-service)).

---

## 5. Webhook configuration (QEngine)

This is the **recommended** and easiest way to trigger dashboard generation automatically.

### Steps in QEngine

1. Go to **Settings → Webhooks → Create Webhook**
2. Set:

| Field | Value |
|-------|-------|
| **Name** | Any name (e.g. `Dashboard Trigger`) |
| **Method** | `GET` |
| **URL to Notify** | `http://<your-host>:8089/webhook` |
| **URL Parameters** | Add one row: Key = `Result`, Value = `<RESULT>` |
| **Notify when** | On completion (success or failed) |

3. Save.

That's it. QEngine substitutes `<RESULT>` with the full JSON payload which contains the execution ID. The service extracts it automatically.

> **Topic name:** QEngine's `<RESULT>` payload includes `testplan_name`. If the Variable Set name (`$Topicname`) is not configured in the webhook URL, the testplan name is used automatically as the Topic.

### Optional: pass the Topic variable explicitly

If you want the Topic to show the runtime variable set name instead of the testplan name, add a second URL parameter:

| Key | Value |
|-----|-------|
| `Result` | `<RESULT>` |
| `topic` | `<VARIABLES>` ← QEngine variable macro for the Variable Set name |

---

## 6. Public Dashboard page

Open in any browser: `http://<host>:8089`

Shows a table of all generated runs:

| Column | Description |
|--------|-------------|
| **Topic** | The test topic / testplan name |
| **Run ID** | QEngine `scheduleexecutions_id` |
| **Result** | e.g. `15/16 passed (93.75%)` |
| **Generated** | Timestamp when the dashboard was created |
| **PDF** | Link to the printable PDF report |

An **⚙ Admin** link in the top-right corner opens the Admin Console.

---

## 7. Admin Console

URL: `http://<host>:8089/admin`

### Login

| Field | Value |
|-------|-------|
| Username | `prathosh` |
| Password | `Agent@123` |

> Credentials can be changed via environment variables `ADMIN_USER` and `ADMIN_PASS` before starting the server.

### Features

| Action | How |
|--------|-----|
| **Edit Topic name** | Click the ✏️ pencil icon next to the topic → type new name → **Save** (updates `report.json` in place, reflected immediately on the public page) |
| **Delete a run** | Click **Delete** → confirm → the run folder and all its files are permanently removed |
| **Open dashboard** | Click **Dashboard** link to open the HTML dashboard in a new tab |
| **Open PDF** | Click **PDF** link |
| **View raw JSON** | Click **JSON** link |
| **Logout** | Click **Logout** in the top-right corner |

### Admin API endpoints (protected)

| Method | URL | Description |
|--------|-----|-------------|
| `GET` | `/admin` | Admin console UI |
| `GET/POST` | `/admin/login` | Login page |
| `GET` | `/admin/logout` | Logout |
| `POST` | `/admin/delete/<run_id>` | Delete a run folder |
| `POST` | `/admin/rename/<run_id>` | Update topic name in report.json — body: `{"topic": "New Name"}` |

---

## 8. CLI usage

You can also generate dashboards from the command line without the server:

```powershell
# By run ID (recommended — resolves everything automatically)
python main.py --run-id 4443000075874362 --output .\Reports

# By environment ID
python main.py --project-id 4443000000022861 --env-id 4443000075913226 --output .\Reports

# By result URL
python main.py --result-url "https://qengine.zoho.in/uems/projects/<pid>/results/<envId>" --output .\Reports

# Offline from a captured HAR file
python main.py --har Agent_Prelims.har --output .\output

# Override the Topic name
python main.py --run-id 4443000075874362 --topic "My_Topic" --output .\Reports
```

### CLI flags

| Flag | Description |
|------|-------------|
| `--run-id` | `scheduleexecutions_id` — resolves env id, topic, test plan, reruns |
| `--env-id` | `executedenvironment_id` (alternative to `--run-id`) |
| `--project-id` | QEngine project ID (or set `PROJECT_ID` in `.env`) |
| `--testplan-id` | Test plan ID (optional, auto-derived from run) |
| `--result-url` | Full QEngine result URL |
| `--topic` | Override topic name |
| `--har` | Path to `.har` file (offline mode) |
| `--output` | Output folder (default `./output`) |
| `--config` | Path to YAML config file |
| `--all-details` | Fetch detail for every case (default: failed only) |
| `--self-contained` | Inline Plotly JS so HTML works without CDN |
| `-v / --verbose` | Debug logging |

---

## 9. API reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/` or `/dashboards` | Public dashboard listing |
| `GET` | `/latest` | Redirect to the most recent dashboard |
| `GET` | `/health` | Health check — returns `{"status":"ok"}` |
| `GET/POST` | `/execute` | Trigger dashboard generation |
| `GET/POST` | `/webhook` | QEngine webhook receiver (use this in QEngine) |
| `POST` | `/upload` | Upload a log zip for a topic |
| `GET` | `/uploads/<topic>/<file>` | Download an uploaded log file |
| `GET` | `/dashboards/<run_id>/<file>` | Serve a generated file |

### `/execute` parameters

| Parameter | Required | Description |
|-----------|----------|-------------|
| `run_id` | Yes (or `env_id`) | `scheduleexecutions_id` |
| `env_id` | Yes (or `run_id`) | `executedenvironment_id` |
| `project_id` | Optional | Defaults to `PROJECT_ID` in `.env` |
| `testplan_id` | Optional | Enriches header metadata |
| `topic` | Optional | Topic name override |
| `result_url` | Optional | Alternative to project+env |
| `format=html` | Optional | Redirect to dashboard HTML instead of JSON |

Example (PowerShell):
```powershell
$r = Invoke-RestMethod "http://localhost:8089/execute?run_id=4443000075874362"
Start-Process $r.dashboard_url
```

---

## 10. Topic name — how it is resolved

The **Topic** column in the dashboard listing is resolved in this priority order:

1. `topic` parameter passed explicitly in the webhook URL or `/execute` call
2. `environmentvariables_name` from the QEngine API (the Variable Set name)
3. `variablesName` / `variables` fields in the schedule execution block
4. `testplan_name` from the QEngine `<RESULT>` webhook payload
5. `execution_name` from the environment block

To **manually fix** a topic name on an existing run, use the Admin Console (✏️ icon) — it updates `report.json` immediately.

---

## 11. Output files

Each run is stored under `report_generator/output/runs/<run_id>/`:

| File | Description |
|------|-------------|
| `dashboard.html` | Interactive Bootstrap 5 dashboard with Plotly charts |
| `dashboard.pdf` | Printable PDF report (generated in background after HTML) |
| `report.json` | Full normalised summary — used by the dashboard listing |
| `execution.csv` | Flat CSV of all test cases |

---

## 12. Configuration reference

### Environment variables (`.env` file)

| Variable | Description | Default |
|----------|-------------|---------|
| `CLIENT_ID` | Zoho OAuth client ID | — |
| `CLIENT_SECRET` | Zoho OAuth client secret | — |
| `REFRESH_TOKEN` | Zoho OAuth refresh token | — |
| `PROJECT_ID` | QEngine project ID | — |
| `DASHBOARD_PORT` | Server port | `8089` |
| `DASHBOARD_OUTPUT_ROOT` | Where run folders are written | `report_generator/output/runs` |
| `DASHBOARD_LOG_ROOT` | Where uploaded log zips are stored | `report_generator/output/uploaded_logs` |
| `DASHBOARD_MAX_UPLOAD_MB` | Max upload size | `2048` (2 GB) |
| `DASHBOARD_SECRET_KEY` | Flask session secret key | built-in default |
| `ADMIN_USER` | Admin console username | `prathosh` |
| `ADMIN_PASS` | Admin console password | `Agent@123` |
| `GOAT_HOME` | GOAT install directory (enables GOAT enrichment) | — |
| `DASHBOARD_VERBOSE` | Set to `1` for debug logging | — |

---

## 13. Running as a Windows Service

A Scheduled Task installer is included. Run once as Administrator:

```powershell
# Install as a Scheduled Task (auto-start on login)
powershell -ExecutionPolicy Bypass -File report_generator\service\install_task.ps1

# Uninstall
powershell -ExecutionPolicy Bypass -File report_generator\service\uninstall_task.ps1
```

Or use the batch launcher directly (keeps a log in `logs/service.log`):

```powershell
report_generator\service\run_dashboard.bat
```

---

## 14. Troubleshooting

### Topic shows wrong name
- **Cause:** QEngine's Variable Set name is returned as-is from the API. If the Variable Set is named "Agent_Prelims", all runs using that set will show that name.
- **Fix (permanent):** Configure the webhook to pass `topic=<VARIABLES>` URL parameter with the QEngine variable macro for the Variable Set name.
- **Fix (one-off):** Go to `/admin` → click ✏️ next to the run → enter the correct name → Save.

### Dashboard not generated after webhook fires
1. Check the service is running: `http://<host>:8089/health`
2. Check `logs/service.log` for errors
3. Check the webhook response in QEngine — the service returns `{"status":"error","received":{...}}` if it can't find a run ID, with all received keys listed

### OAuth token errors
```powershell
cd D:\Qengine_Result_Dashboard
python -c "import sys; sys.path.insert(0,'report_generator'); from auth import get_access_token; print(get_access_token()[:20])"
```
If this fails, regenerate the refresh token and update `.env`.

### Port already in use
```powershell
# Find what's using port 8089
netstat -ano | findstr :8089
# Kill it by PID
Stop-Process -Id <PID> -Force
```

### Manually trigger a run (test the webhook)
```powershell
$r = Invoke-RestMethod "http://localhost:8089/execute?run_id=<run_id>"
$r
```
