# Live Dashboard — QEngine code + testing steps (OAuth-only, no cookies)

## Inputs (1 effective variable)

| Variable | Where it comes from | Required |
|----------|--------------------|----------|
| **run id** (`scheduleexecutions_id`) | the **current execution** — QEngine context (you don't type it) | yes |
| `$Topicname` | you already set it; scopes which GOAT log zips are collected | optional |

> Over OAuth there is **no** Topic→run lookup (that list is cookie-only). So we
> use the run id, which the final test case reads from its own execution
> context. From the run id the tool resolves env id, Topic, test plan and the
> Run/Re-Run breakdown automatically.

---

## A. One-time setup on the dashboard host (the box with the tool)

```powershell
cd D:\Qengine_Result_Dashboard
python -m pip install -r report_generator\requirements.txt
# put OAuth creds in report_generator\.env  (CLIENT_ID / CLIENT_SECRET / REFRESH_TOKEN / PROJECT_ID)
python -c "import sys; sys.path.insert(0,'report_generator'); from auth import get_access_token; print('token OK', len(get_access_token()))"
# start the service (keep it running; or install as a service later)
python -m report_generator.server      # http://<host>:8089
```

---

## B. Prove it live with a known run id (before wiring QEngine)

Pick any real `scheduleexecutions_id` (e.g. the `id` of a run from the
scheduleexecutions list, like `4443000074661121`).

```powershell
# CLI
cd D:\Qengine_Result_Dashboard
python main.py --run-id 4443000074661121 --topic "Agent_Prelims" --goat-home "D:\GOAT" --output .\Reports
start .\Reports\dashboard.html

# or via the service (single URL)
$r = Invoke-RestMethod -Method Post "http://localhost:8089/execute?run_id=4443000074661121&topic=Agent_Prelims&goat_home=D:\GOAT"
$r ; start ("http://localhost:8089" + $r.dashboard_url)
```

✅ Expected log:
```
Resolving run 4443000074661121 … → resolved env_id=4443000074661122
topic: Agent_Prelims | plan: Agent_Prelims_OP | 15 cases · 14/1 · reruns: 2
```

---

## C0. RECOMMENDED — trigger via a completion Webhook (not a test case)

A final test case can't know the **run id** (it's created when the plan starts)
and runs **before** reruns. A **webhook** solves both: it fires on completion
and QEngine fills in the execution context.

**Settings → Webhooks → Create Webhook:**
- **Method:** GET
- **URL to Notify:** `http://UEMS-Agent-QA:8089/webhook`   ← base only
- **URL Parameters:** just one row —
  - `Result` = `<RESULT>`
- Fire **on completion** (success/failed), not "running".

That's it. QEngine's `<RESULT>` JSON contains `execution_id` (e.g.
`1324655745888`); the service reads it, then resolves the env id, **Topic**
(`environmentvariables_name`), test plan and reruns over OAuth, and links the
uploaded logs by the resolved Topic. **Do NOT add `run_id`/`topic` rows with
`<…macro>` text — those aren't real macros and are ignored.**

> Verify: trigger once. If the dashboard doesn't appear, the service reply
> includes a `received` / `_seen_keys` list of the exact fields QEngine sent.

The dashboard then appears at
`http://UEMS-Agent-QA:8089/dashboards/<run_id>/dashboard.html`.

---

## C. Alternative — a final test case (if you can't use a webhook)

Set the run id from the current execution context. The exact built-in name
depends on your QEngine setup — use the one that holds the **current schedule
execution id** (commonly `@scheduleexecutions_id`). If unsure, run step B with a
hard-coded id first, then swap in the context variable.

```js
// ---- Generate_Dashboard : LAST test case in the plan ----
serviceUrl = "http://<DASHBOARD_HOST>:8089/execute";
runId      = @scheduleexecutions_id;   // current run id (from execution context)
topicName  = $Topicname;               // scopes GOAT log collection
goatHome   = "D:\\GOAT";               // optional

execUrl = serviceUrl + "?run_id=" + runId + "&topic=" + topicName + "&goat_home=" + goatHome;
dashboardCmd = "$r = Invoke-RestMethod -Uri '" + execUrl + "' -Method Post -TimeoutSec 600; if ($r.status -eq 'ok') { Write-Output ('Dashboard ready: ' + $r.dashboard_url) } else { Write-Error $r.message; exit 1 }";

payload = {
  "testcase_id": "Generate_Dashboard",
  "reuse_installation": true,
  "operations": [
    { "operation_type": "run_command",
      "parameters": { "command_type": "powershell", "command_to_run": dashboardCmd,
                      "exact_value": "Dashboard ready", "max_wait_time": 600, "check_interval": 10 } }
  ],
  "expected_result": "Dashboard generated for " + $Topicname
};

goat.common_funtions.goatexecutewithpayload(payload.toString(), @Agent_MachineName);
goat.common_funtions.goatstatusapiwithid_withinterval(@Agent_MachineName, "Generate_Dashboard", 200, 10);
info("Dashboard requested for run " + runId);
```

> If your QEngine doesn't expose the current run id to the script, set a plan
> variable `RunId` and pass `runId = $RunId;` — but the context variable avoids
> any manual step.

---

## D. Where to find a run id manually (for testing / ad-hoc)

- It's the number after `…/results/` is the **env id**; the **run id** is the
  `scheduleexecutions_id`. In the browser result page Network tab, any
  `…/testcaseresult/<caseId>` detail response shows `scheduleexecutions_id`.
- Or from the scheduleexecutions list (the JSON you have), each entry's top-level
  `id` is the run id (e.g. `4443000074661121`).

---

## D2. Upload this topic's logs to the dashboard (from each machine)

Add this **one operation** to your existing Upload-Logs test case (right after
the `zip_operation` that creates the archive, on each of the 4 machines). It
POSTs the staged zip straight to the dashboard service; the next
`Generate_Dashboard` run links all of them under **Logs & Artifacts**.

```jsonc
{
  "operation_type": "run_command",
  "parameters": {
    "command_type": "powershell",
    "command_to_run": "$f = '" + zipFilePath + "'; $n = [IO.Path]::GetFileName($f); $u = 'http://UEMS-Agent-QA:8089/upload?topic=' + [uri]::EscapeDataString('" + $Topicname + "') + '&filename=' + [uri]::EscapeDataString($n); try { $r = Invoke-RestMethod -Uri $u -Method Post -InFile $f -ContentType 'application/octet-stream' -TimeoutSec 600; Write-Output ('Uploaded: ' + $r.url) } catch { Write-Output ('Upload failed: ' + $_.Exception.Message); exit 1 }",
    "exact_value": "Uploaded"
  }
}
```

- Do the same in the DS branch with `DS_zipFilePath`.
- The dashboard service stores them under `output\uploaded_logs\<Topic>\` and
  serves each at `http://UEMS-Agent-QA:8089/uploads/<Topic>/<file>`.
- Order: run Upload-Logs (all machines) **before** the final `Generate_Dashboard`
  case so the logs are present when the dashboard is built.

## E. Outputs

`Reports\dashboard.html` (interactive), `dashboard.pdf`, `report.json`,
`execution.csv`, `execution.xlsx`. Via the service they're at
`http://<host>:8089/dashboards/<run_id>/dashboard.html`.

---

## Troubleshooting
| Symptom | Fix |
|---------|-----|
| `Could not determine an executedenvironment_id` | The run id was empty — confirm the context variable, or pass `--run-id`. |
| Resolves but `0 cases` | The run hasn't produced results yet / wrong id. |
| Want Topic-name input instead of run id | Not possible over OAuth (list is cookie-only). Use the run id from context. |
| `OAuth token refresh failed` | Fix `.env` credentials. |
