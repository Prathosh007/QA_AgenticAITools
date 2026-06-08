component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTEXE-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTEXE-002",
  "description": "Silent EXE install without administrator privileges",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 60,
        "description": "Attempt silent install as standard user"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify agent service is NOT installed"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify agent directory does not exist"
      }
    }
  ],
  "expected_result": "Installation fails with permission error. Agent service NOT installed. No agent files created."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
