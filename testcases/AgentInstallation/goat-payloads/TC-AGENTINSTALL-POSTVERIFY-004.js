component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-004";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-004",
  "description": "Verify agent process is running after installation",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "task_manager",
      "parameters": {
        "action": "verify_process",
        "process_name": "DCAgentService.exe",
        "expect": "processrunning",
        "description": "Verify DCAgentService.exe is running"
      }
    }
  ],
  "expected_result": "DCAgentService.exe is listed as a running process."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
