# Single-Action Dashboard — QEngine + GOAT Integration

This explains how to make **one final test case** in your QEngine Test Plan
produce the complete dashboard — pulling QEngine results, GOAT execution
remarks, the staged **Agent/DS log zips**, and the **failure screenshots** — in
a single action.

---

## 1. The topology

```
 QEngine (scheduler)                    Central GOAT server (e.g. D:\GOAT)
 ─────────────────────                  ─────────────────────────────────
 Test Plan runs N cases                 - report_generator tool installed
   each case →                          - test_status/<id>/  (remarks, errors,
   goatexecutewithpayload(payload,         Screenshots_*)
                          <machine>)     - UploadFiles/      (collected zips)
        │                                - GOAT REST :9295/api/files/*
        ▼
  Agent machine GOAT  ── stages ──►  C:\temp\upload_staging\<Topic>\*.zip
  DS machine GOAT     ── stages ──►  C:\temp\upload_staging\<Topic>\*.zip
        │  (upload step pushes the zip to the CENTRAL server)
        ▼
  POST http://<central-goat>:9295/api/files/upload?file=<name>  ──► UploadFiles
```

Each machine runs its **own** GOAT and executes locally. So the log zips and
failure screenshots are produced **on the machine where the case ran**. To get
them into one dashboard we (a) push each zip to the **central** GOAT's
`UploadFiles`, then (b) the final case runs the dashboard tool on the central
GOAT, which reads QEngine + local GOAT results and links the collected files.

---

## 2. Step A — push each machine's zip to the central server

Add this **one operation** to the end of your existing Agent/DS log-zip test
case (right after the `zip_operation` that creates the archive, before the
staging-folder delete). It uploads the freshly-made zip to the **central** GOAT
`UploadFiles` so the dashboard can serve it via `/api/files/download`.

```jsonc
{
  "operation_type": "run_command",
  "parameters": {
    "command_type": "powershell",
    "command_to_run": "$f='" + zipFilePath + "'; $u='http://<CENTRAL_GOAT_HOST>:9295/api/files/upload?file=' + [System.IO.Path]::GetFileName($f); try { Invoke-RestMethod -Uri $u -Method Post -InFile $f -ContentType 'application/octet-stream' -TimeoutSec 600; Write-Output 'Uploaded' } catch { Write-Output ('Upload failed: ' + $_.Exception.Message) }",
    "exact_value": "Uploaded"
  }
}
```

Replace `<CENTRAL_GOAT_HOST>` with the hostname/IP of the machine that will
generate the dashboard. Do the same in the DS branch (`DS_zipFilePath`).

> If your central host **is** the machine that staged the zip (single-box
> setup), you can skip this — the tool already picks up
> `C:\temp\upload_staging\**\*.zip` and `UploadFiles\*.zip` directly.

---

## 3. Step B — the final "Generate_Dashboard" test case (the single action)

Make this the **last** test case in the plan. It runs the report generator on
the central GOAT server with `run_command`. The tool fetches QEngine results
(cookie or OAuth), merges GOAT local remarks, collects the uploaded zips +
screenshots, and writes everything to the output folder.

```jsonc
{
  "testcase_id": "Generate_Dashboard",
  "description": "Build the QEngine + GOAT execution dashboard (single action)",
  "reuse_installation": true,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_type": "powershell",
        "command_to_run": "cd D:\\Qengine_Result_Dashboard; python main.py --result-url '<QENGINE_RESULT_URL>' --cookie '<BROWSER_COOKIE>' --goat-home 'D:\\GOAT' --output 'D:\\GOAT\\logs\\dashboards\\<RUN>' ; if ($LASTEXITCODE -eq 0) { Write-Output 'Dashboard ready' } else { exit $LASTEXITCODE }",
        "exact_value": "Dashboard ready"
      }
    }
  ],
  "expected_result": "Interactive dashboard, PDF, JSON and CSV generated"
}
```

**Notes**
- Prefer `--oauth '<token>'` over `--cookie` if you have an OAuth token; the
  tool tries OAuth first, then cookie.
- `--test-id '<RUN>'` pins a specific GOAT `test_status` run; omit to use the
  most recent.
- Add `--publish-via-api` to also push locally-found zips/screenshots through
  the GOAT API (useful when the tool runs somewhere other than the GOAT box).
- **CommandExecutor whitelist:** GOAT's `run_command` validates against a
  whitelist. If `python …` is blocked, either (i) add it to the admin-expandable
  whitelist, or (ii) wrap the call in a small approved `.bat` (e.g.
  `D:\GOAT\UploadFiles\run.bat`) and invoke that, or (iii) run the tool from a
  QEngine-native command step instead of via GOAT.

### Calling it from your QEngine script

Exactly like your existing steps:

```js
payload = { /* the Generate_Dashboard payload above */ };
goat.common_funtions.goatexecutewithpayload(payload.toString(), @Agent_MachineName);
goat.common_funtions.goatstatusapiwithid_withinterval(@Agent_MachineName, "Generate_Dashboard", 200, 10);
info("Dashboard generated on the central GOAT server.");
```

---

## 4. What feeds each part of the dashboard

| Dashboard element | Source |
|-------------------|--------|
| Summary cards, KPIs, charts, per-case table, reruns | QEngine API (cookie/OAuth) |
| Per-case **Error Remarks** / full execution log | GOAT `test_status.json` → merged by name (exact/normalized) |
| Unmatched component steps | "GOAT Step Remarks" appendix (nothing lost) |
| **Log archives** (Agent/DS zips) | `C:\temp\upload_staging\**\*.zip` + `UploadFiles\*.zip` → linked via `/api/files/download` |
| **Failure screenshots** | GOAT `test_status/<id>/Screenshots_*` + `…/AgentBinaries/Screenshot` → embedded inline + linked |

---

## 5. Config-file alternative

Instead of long CLI args, drop a `config.yaml` next to the tool and call
`python main.py --config config.yaml`:

```yaml
result_url: "https://qengine.zoho.in/uems/projects/4443000000022861/results/4443000074661122"
cookie: "<BROWSER_COOKIE>"          # or: oauth: "<token>"
goat_home: "D:\\GOAT"               # enables GOAT enrichment
# test_id: "24-Jun-20262144"        # optional: pin a GOAT run; else most recent
publish_via_api: false
output: "D:\\GOAT\\logs\\dashboards\\latest"
```

---

## 6. Output

```
<output>/
├── dashboard.html      interactive (charts, artifacts, screenshots, GOAT remarks)
├── dashboard.pdf       professional report (charts + failures + logs table)
├── report.json         full machine-readable summary incl. artifacts
├── execution.csv
└── execution.xlsx      Summary / Test Cases / Failures sheets
```

You can also serve `dashboard.html` through GOAT: copy it into `UploadFiles`
and open `http://<central-goat>:9295/api/files/download?filename=dashboard.html`.
