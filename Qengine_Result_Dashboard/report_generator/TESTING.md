# Local Testing Guide — QEngine Dashboard Tool

Step-by-step instructions to run and verify the tool on your machine
(Windows + PowerShell). Commands assume the project root
`D:\Qengine_Result_Dashboard`.

---

## 0. Prerequisites

- **Python 3.11+** (`python --version`)
- **Google Chrome or Edge** installed (used to render the PDF)
- Network access to `accounts.zoho.in` and `qengine.zoho.in`

---

## 1. Install dependencies (one time)

```powershell
cd D:\Qengine_Result_Dashboard
python -m pip install -r report_generator\requirements.txt
```

This installs requests, pandas, plotly, jinja2, openpyxl, python-dotenv, flask,
kaleido (PDF chart images) and weasyprint (optional).

---

## 2. Configure OAuth credentials (one time)

The tool authenticates with the Zoho refresh-token flow. Credentials live in
`report_generator\.env`:

```
CLIENT_ID=1000.xxxx
CLIENT_SECRET=xxxx
REFRESH_TOKEN=1000.xxxx.xxxx
TOKEN_URL=https://accounts.zoho.in/oauth/v2/token
PROJECT_ID=4443000000022861
```

**Verify the token works:**

```powershell
cd D:\Qengine_Result_Dashboard\report_generator
python -c "from auth import get_access_token; print('OK token len', len(get_access_token()))"
```

Expected: `OK token len 70` (a number). If you see an auth error, the
refresh token/secret is wrong or expired.

---

## 3. Test 1 — Offline mode (no network, fastest sanity check)

Uses the bundled HAR capture, so it needs no credentials or network.

```powershell
cd D:\Qengine_Result_Dashboard
python main.py --har Agent_Prelims.har --output .\report_generator\output
```

Then open the dashboard:

```powershell
start .\report_generator\output\dashboard.html
```

✅ **Pass if:** the log ends with `Done. 15 cases · 14 passed · 1 failed · 93.33% pass rate.`
and `output\` contains `dashboard.html, dashboard.pdf, report.json, execution.csv, execution.xlsx`.

---

## 4. Test 2 — Live OAuth (official v1 API)

Generate a dashboard for a real run. The run is identified by
`executedenvironment_id` (`--env-id`). `--testplan-id` and `--topic` are optional
but fill the Topic / Plan / Executed-By header fields.

```powershell
cd D:\Qengine_Result_Dashboard
python main.py `
  --project-id 4443000000022861 `
  --env-id 4443000074661122 `
  --testplan-id 4443000074239826 `
  --topic "Agent_Prelims" `
  --output .\Reports
```

✅ **Pass if:** the log shows `Using official QEngine v1 API (OAuth)`, then
`15 cases.` and `Done … 93.33% pass rate`. Open `.\Reports\dashboard.html`.

**Where do the ids come from?**
- `--env-id` = the `results/<id>` number in the QEngine result URL
  (`…/projects/4443000000022861/results/4443000074661122`).
- `--project-id` = the `projects/<id>` number.
- `--result-url "<full URL>"` can be used instead of `--project-id` + `--env-id`.
- `--testplan-id` = the test plan's id (optional).

**Verify the parsed data:**

```powershell
python -c "import json;s=json.load(open('Reports/report.json',encoding='utf-8'))['summary'];print(s['topic_name'],'|',s['test_plan_name'],'|',s['passed'],'/',s['total_cases'])"
```

---

## 5. Test 3 — With GOAT enrichment (logs + screenshots + remarks)

Run on the GOAT box and point at the GOAT home. Adds the **Logs & Artifacts**
section, embeds **failure screenshots**, and merges GOAT **Error Remarks**.

```powershell
cd D:\Qengine_Result_Dashboard
python main.py `
  --project-id 4443000000022861 --env-id 4443000074661122 `
  --topic "Agent_Prelims" `
  --goat-home "D:\GOAT" `
  --output .\Reports
```

✅ **Pass if:** the log shows `Collected N log archive(s) for topic 'Agent_Prelims'`
and `… screenshot(s)`, and the dashboard shows a **Logs & Artifacts** card plus
inline failure screenshots.

- Only the given `--topic`'s zips in `C:\Temp\upload_staging\<Topic>\` are picked up.
- Screenshots come from `D:\GOAT\product_package\bin\AgentBinaries\Logs\NativeGUI\Screenshots`.
- `--test-id "<run-folder>"` pins a specific GOAT `test_status` run (else most recent).

**GOAT-only (no QEngine):**

```powershell
python main.py --goat-home "D:\GOAT" --topic "Prevent_UEM" --output .\Reports
```

---

## 6. Test 4 — The execute-URL service (single action)

Start the HTTP service:

```powershell
cd D:\Qengine_Result_Dashboard
python -m report_generator.server
```

Leave it running. In a **second** PowerShell window:

```powershell
# Health check
Invoke-RestMethod "http://localhost:8089/health"

# Generate a dashboard via one URL (run_id resolves env + Topic + reruns)
$r = Invoke-RestMethod -Method Post "http://localhost:8089/execute?run_id=4443000074661121&topic=Agent_Prelims&goat_home=D:\GOAT"
$r

# Open the generated dashboard in the browser
start ("http://localhost:8089" + $r.dashboard_url)
```

✅ **Pass if:** the response has `status = ok` and a `dashboard_url`, and the
browser shows the dashboard. This is exactly what the QEngine final test case
([qengine_generate_dashboard.js](qengine_generate_dashboard.js)) calls.

Stop the service with **Ctrl+C**.

---

## 4b. Resolve the run by run id (recommended, OAuth-only)

Pass the **`run_id` (scheduleexecutions_id)** and the tool resolves the env id,
Topic, test plan and rerun breakdown automatically — no cookie:

```powershell
python main.py --run-id 4443000074661121 --output .\Reports
```

✅ **Pass if:** the log shows `Resolving run … → resolved env_id=…`, then the
header has `topic: Agent_Prelims | plan: Agent_Prelims_OP` and `reruns: 2`.

---

## 7. Test 5 — Config file instead of flags (optional)

```powershell
copy report_generator\config.example.yaml report_generator\myrun.yaml
# edit project_id / env_id / testplan_id in myrun.yaml
python main.py --config report_generator\myrun.yaml --output .\Reports
```

---

## 8. What to check in the output

| File | Open with | Look for |
|------|-----------|----------|
| `dashboard.html` | browser | KPI cards, charts, failure analysis, detailed table |
| `dashboard.pdf` | PDF viewer | same content, multi-page, embedded charts |
| `report.json` | text editor | `summary`, `cases[]`, `artifacts`, `conclusion` |
| `execution.csv` | Excel | one row per test case |
| `execution.xlsx` | Excel | Summary / Test Cases / Failures sheets |

Add `-v` to any command for verbose debug logging.

---

## 9. Troubleshooting

| Symptom | Cause / Fix |
|---------|-------------|
| `OAuth token refresh failed` / 400 from token URL | Wrong/expired `REFRESH_TOKEN` or secret in `.env`. Regenerate the refresh token. |
| `Live mode needs env_id` | Pass `--env-id` (or `--result-url`), or use `--har` / `--goat-home` only. |
| `HTTP 400 … Extra param found` | You're on an old build — v1 detail calls take no extra params; pull the latest `oauth_client.py`. |
| PDF missing, `report_print.html` created | No Chrome/Edge found and WeasyPrint libs absent. Install Chrome; the tool auto-uses it. |
| Charts blank in PDF | `kaleido` not installed → `pip install kaleido`. |
| `Collected 0 log archive(s)` | Topic doesn't match the `C:\Temp\upload_staging\<Topic>` folder name, or zips not staged yet. |
| Wrong/old screenshot | Confirm `--goat-home` is set so `…\AgentBinaries\Logs\NativeGUI\Screenshots` is scanned. |
| Service `port already in use` | Set a different port: `$env:DASHBOARD_PORT=8090; python -m report_generator.server`. |

---

## 10. One-line smoke test

```powershell
cd D:\Qengine_Result_Dashboard; python main.py --har Agent_Prelims.har --output .\report_generator\output; start .\report_generator\output\dashboard.html
```
