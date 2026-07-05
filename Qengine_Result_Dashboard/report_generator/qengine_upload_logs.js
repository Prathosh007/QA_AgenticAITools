// ============================================================
// Upload-Logs (Agent + DS) — copies logs, zips them, and UPLOADS the zip
// to the dashboard service so it appears under "Logs & Artifacts".
// The upload runs on each machine and POSTs to the central dashboard host.
// Keep every string on ONE line (the engine is line-oriented).
// ============================================================

dashHost = "prathosh-14802-t";   // <-- the box running the dashboard service (:8089)

// ============================================================
// STEP 1 — Agent paths
// ============================================================
Agent_Logs_path = "C:\\Program Files (x86)\\ManageEngine\\UEMS_Agent\\logs";
AgentMachine    = @Agent_MachineName;
testcaseID      = "Upload_Agent_Logs";

localStaging     = "C:\\temp\\upload_staging\\";
zipFileName      = $Topicname + "_" + @Agent_MachineName + "_" + @Protocol + "_Agentlogs.zip";
zipFilePath      = localStaging + $Topicname + "\\" + zipFileName;
agentStagingLogs = "C:\\temp\\upload_staging\\" + $Topicname + "\\logs";

info("Remote path  : " + Agent_Logs_path);
info("Zip output   : " + zipFilePath);

payload = {
  "testcase_id": testcaseID,
  "description": "Copy agent log from remote machine, zip it and upload to dashboard",
  "reuse_installation": true,
  "operations": [

    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "create",
        "file_path": "C:\\temp\\upload_staging\\" + $Topicname + "\\logs",
        "type": "folder",
        "delete_if_exists": "true"
      }
    },

    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "robocopy '" + Agent_Logs_path + "' '" + agentStagingLogs + "' /E /R:0 /W:0 /XD EDR /NP /NJH /NJS /NFL; if ($LASTEXITCODE -le 7) { Write-Output 'Files copied successfully'; exit 0 } else { exit $LASTEXITCODE }",
        "command_type": "powershell",
        "exact_value": "Files copied successfully"
      }
    },

    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": agentStagingLogs
      }
    },

    {
      "operation_type": "zip_operation",
      "parameters": {
        "action": "create",
        "archive_path": zipFilePath,
        "source_path": agentStagingLogs
      }
    },

    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "delete",
        "file_path": agentStagingLogs
      }
    },

    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "$f='" + zipFilePath + "'; $n=[IO.Path]::GetFileName($f); $u='http://" + dashHost + ":8089/upload?topic='+[uri]::EscapeDataString('" + $Topicname + "')+'&filename='+[uri]::EscapeDataString($n); try { $r=Invoke-RestMethod -Uri $u -Method Post -InFile $f -ContentType 'application/octet-stream' -TimeoutSec 1800; Write-Output ('Uploaded: '+$r.url) } catch { Write-Output ('Upload failed: '+$_.Exception.Message); exit 1 }",
        "command_type": "powershell",
        "exact_value": "Uploaded"
      }
    }

  ],
  "expected_result": "Logs copied, zipped and uploaded to the dashboard"
};

goat.common_funtions.goatexecutewithpayload(payload.toString(), AgentMachine);
goat.common_funtions.goatstatusapiwithid_withinterval(AgentMachine, testcaseID, 200, 10);

if (@DS_Required == "true" || @DS_Required == "True") {

  // ============================================================
  // DS paths
  // ============================================================
  DS_Logs_path    = "C:\\Program Files (x86)\\ManageEngine\\UEMS_DistributionServer\\logs";
  DSMachine       = @DS_Machine_IP;
  DS_testcaseID   = "Upload_DS_Logs";

  DS_localStaging = "C:\\temp\\upload_staging\\";
  DS_zipFileName  = $Topicname + "_" + @DS_MachineName + "_" + @Protocol + "_DS_logs.zip";
  DS_zipFilePath  = DS_localStaging + $Topicname + "\\" + DS_zipFileName;
  DS_stagingLogs  = "C:\\temp\\upload_staging\\" + $Topicname + "\\logs";

  info("Remote path  : " + DS_Logs_path);
  info("Zip output   : " + DS_zipFilePath);

  DS_payload = {
    "testcase_id": DS_testcaseID,
    "description": "Copy DS log from remote machine, zip it and upload to dashboard",
    "test_id": $testId,
    "reuse_installation": true,
    "operations": [

      {
        "operation_type": "file_folder_operation",
        "parameters": {
          "action": "create",
          "file_path": "C:\\temp\\upload_staging\\" + $Topicname + "\\logs",
          "type": "folder",
          "delete_if_exists": "true"
        }
      },

      {
        "operation_type": "run_command",
        "parameters": {
          "command_to_run": "robocopy \"" + DS_Logs_path + "\" \"" + DS_stagingLogs + "\" /E /R:0 /W:0 /NP /NJH /NJS /NFL & if ERRORLEVEL 8 (exit 1) else echo Files copied successfully",
          "command_type": "cmd",
          "exact_value": "Files copied successfully"
        }
      },

      {
        "operation_type": "file_folder_operation",
        "parameters": {
          "action": "check_presence",
          "file_path": DS_stagingLogs
        }
      },

      {
        "operation_type": "zip_operation",
        "parameters": {
          "action": "create",
          "archive_path": DS_zipFilePath,
          "source_path": DS_stagingLogs
        }
      },

      {
        "operation_type": "file_folder_operation",
        "parameters": {
          "action": "delete",
          "file_path": DS_stagingLogs
        }
      },

      {
        "operation_type": "run_command",
        "parameters": {
          "command_to_run": "$f='" + DS_zipFilePath + "'; $n=[IO.Path]::GetFileName($f); $u='http://" + dashHost + ":8089/upload?topic='+[uri]::EscapeDataString('" + $Topicname + "')+'&filename='+[uri]::EscapeDataString($n); try { $r=Invoke-RestMethod -Uri $u -Method Post -InFile $f -ContentType 'application/octet-stream' -TimeoutSec 1800; Write-Output ('Uploaded: '+$r.url) } catch { Write-Output ('Upload failed: '+$_.Exception.Message); exit 1 }",
          "command_type": "powershell",
          "exact_value": "Uploaded"
        }
      }

    ],
    "expected_result": "DS Logs copied, zipped and uploaded to the dashboard"
  };

  goat.common_funtions.goatexecutewithpayload(DS_payload.toString(), DSMachine);
  goat.common_funtions.goatstatusapiwithid_withinterval(DSMachine, DS_testcaseID, 200, 10);

  info("Uploaded DS Logs (" + DS_zipFilePath + ") from " + @DS_MachineName);
  info("Uploaded Agent Logs (" + zipFilePath + ") from " + @Agent_MachineName);

} else {

  info("Agent is under Local Office, so Zipped + uploaded only Agent Logs");
  info("Uploaded Agent Logs (" + zipFilePath + ") from " + @Agent_MachineName);

}
