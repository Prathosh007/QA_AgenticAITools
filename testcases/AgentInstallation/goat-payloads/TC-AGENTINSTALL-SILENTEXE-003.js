component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SILENTEXE-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SILENTEXE-003",
  "description": "Silent EXE install with invalid argument",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/invalidarg",
        "timeout": 60,
        "description": "Run installer with invalid argument"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify agent NOT silently installed"
      }
    }
  ],
  "expected_result": "Installer either ignores invalid argument and shows GUI, or returns error. Agent NOT silently installed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
