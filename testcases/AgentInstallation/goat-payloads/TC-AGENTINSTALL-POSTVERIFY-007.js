component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-007";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-007",
  "description": "Verify agent service starts after system reboot",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "machine_operation",
      "parameters": {
        "action": "restart",
        "description": "Restart the machine"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 300,
        "check_interval": 10,
        "description": "Verify agent service RUNNING after reboot"
      }
    },
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgentService.exe",
        "expect": "processrunning",
        "description": "Verify agent process running after reboot"
      }
    }
  ],
  "expected_result": "After reboot, agent service automatically starts. Service RUNNING. Process running."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
