component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-STATETR-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-STATETR-001",
  "description": "Agent service stop and manual restart",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "stop",
        "service_name": "ManageEngine UEMS Agent Service",
        "description": "Stop agent service"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "description": "Verify STOPPED"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "start",
        "service_name": "ManageEngine UEMS Agent Service",
        "description": "Start agent service"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "description": "Verify RUNNING"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgentService.exe",
        "expect": "processrunning",
        "description": "Verify process running"
      }
    }
  ],
  "expected_result": "Service stops and starts successfully. Agent process runs after manual restart."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
