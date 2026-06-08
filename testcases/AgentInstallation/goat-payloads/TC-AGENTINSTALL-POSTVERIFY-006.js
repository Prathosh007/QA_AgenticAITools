component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-006";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-006",
  "description": "Verify agent service restarts automatically after being killed",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "kill_process",
        "process_name": "DCAgentService.exe",
        "description": "Kill DCAgentService.exe process"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 60,
        "check_interval": 5,
        "description": "Wait for agent service to auto-restart (up to 60s)"
      }
    }
  ],
  "expected_result": "After killing the process, service auto-restarts. Agent service returns to RUNNING within 60 seconds."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
