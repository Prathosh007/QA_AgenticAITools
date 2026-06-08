component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTMSI-006";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTMSI-006",
  "description": "Silent MSI install with corrupt MSI file",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_command",
      "parameters": {
        "command_to_run": "msiexec /i \"UEMSAgent_corrupt.msi\" /qn TRANSFORMS=\"UEMSAgent.mst\" ENABLESILENT=yes REBOOT=ReallySuppress /lv \"Agentinstalllog.txt\"",
        "command_type": "cmd",
        "description": "Run msiexec with corrupt MSI"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify no agent installed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "No agent files created"
      }
    }
  ],
  "expected_result": "msiexec fails with corrupt/invalid package. No agent installed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
