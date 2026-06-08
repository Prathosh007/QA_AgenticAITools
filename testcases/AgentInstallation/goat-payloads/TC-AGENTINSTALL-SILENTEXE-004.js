component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTEXE-004";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTEXE-004",
  "description": "Silent EXE install with corrupt installer",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\corrupted_Agent.exe",
        "args": "/silent",
        "timeout": 30,
        "description": "Run corrupted EXE with /silent"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify no agent service installed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify no agent files created"
      }
    }
  ],
  "expected_result": "Installation fails. No agent service installed. No agent files created."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
