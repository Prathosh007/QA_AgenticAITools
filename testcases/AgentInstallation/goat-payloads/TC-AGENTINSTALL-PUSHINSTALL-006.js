component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-006";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-006",
  "description": "Push install with invalid admin credentials",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "max_wait_time": 120,
        "check_interval": 10,
        "description": "Verify agent NOT installed after push with invalid creds"
      }
    }
  ],
  "expected_result": "Push install fails due to auth failure. No agent installed on target."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
