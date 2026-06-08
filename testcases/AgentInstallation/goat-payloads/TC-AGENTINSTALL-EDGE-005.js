component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-EDGE-005";
payload = {
  "testcase_id": "TC-AGENTINSTALL-EDGE-005",
  "description": "Install agent with Unicode characters in OS user profile path",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Silent install under Unicode user profile"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify service"
      }
    }
  ],
  "expected_result": "Agent installs regardless of user profile path encoding. Service RUNNING."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
