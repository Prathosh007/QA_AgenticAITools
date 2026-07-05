// ============================================================
//  FINAL QEngine TEST CASE  —  Generate_Dashboard  (LAST case in the plan)
//
//  Hits ONE execute URL on the dashboard service. The service fetches the run
//  entirely via the official QEngine v1 OAuth API (NO cookie):
//    * /scheduleexecutions/{run_id}  -> env id + Topic + test plan + reruns
//    * /testcaseresult?executedenvironment_id=...  -> per-case results
//    * /testcaseresult/{id}          -> failure traces + screenshots
//  ...then merges GOAT logs/screenshots/remarks and writes the dashboard.
//
//  Prereq (one-time, on the box running the service = DASHBOARD_HOST):
//     pip install -r report_generator\requirements.txt
//     set OAuth creds + GOAT_HOME in report_generator\.env
//     python -m report_generator.server          (listens on :8089)
//
//  Keep every string on ONE line (this engine is line-oriented).
//  GOAT_HOME is read from the service .env, so DO NOT pass a path in the URL.
// ============================================================

// ---- Inputs ----
dashHost  = "prathosh-14802-t";        // <-- the box running the dashboard service
runId     = $scheduleexecutions_id;    // current run id (from execution context)
topicName = $Topicname;                // scopes which GOAT log zips are collected

// PowerShell: build URL (topic URL-encoded), call the service, print URL + path.
// try/catch prints the real error (e.g. "Unable to connect") instead of looping.
dashboardCmd = "$u = 'http://" + dashHost + ":8089/execute?run_id=" + runId + "&topic=' + [uri]::EscapeDataString('" + topicName + "'); try { $r = Invoke-RestMethod -Uri $u -Method Post -TimeoutSec 120; if ($r.status -eq 'ok') { Write-Output 'Dashboard ready'; Write-Output ('URL : ' + $r.dashboard_url); Write-Output ('PDF : ' + $r.pdf_url); Write-Output ('Path: ' + $r.dashboard_path) } else { Write-Output ('FAILED: ' + $r.message); exit 1 } } catch { Write-Output ('REQUEST FAILED: ' + $_.Exception.Message); exit 1 }";

payload = {
  "testcase_id": "Generate_Dashboard",
  "description": "Generate the QEngine + GOAT execution dashboard (single execute URL)",
  "reuse_installation": true,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_type": "powershell",
        "command_to_run": dashboardCmd,
        "exact_value": "Dashboard ready"
      }
    }
  ],
  "expected_result": "Dashboard generated for topic " + $Topicname
};

goat.common_funtions.goatexecutewithpayload(payload.toString(), @Agent_MachineName);
goat.common_funtions.goatstatusapiwithid_withinterval(@Agent_MachineName, "Generate_Dashboard", 200, 10);

info("Dashboard requested for run " + runId + " (topic '" + $Topicname + "').");
info("Open it at: http://" + dashHost + ":8089/dashboards/" + runId + "/dashboard.html");


// ============================================================
//  ALTERNATIVE — no service. Run the tool directly (single line):
//  dashboardCmd = "cd 'D:\\Qengine_Result_Dashboard'; python main.py --run-id '" + runId + "' --topic '" + topicName + "' --goat-home 'D:\\GOAT' --output 'D:\\GOAT\\logs\\dashboards\\" + topicName + "'; if ($LASTEXITCODE -eq 0) { Write-Output ('Dashboard ready: D:\\GOAT\\logs\\dashboards\\" + topicName + "\\dashboard.html') } else { exit $LASTEXITCODE }";
// ============================================================
