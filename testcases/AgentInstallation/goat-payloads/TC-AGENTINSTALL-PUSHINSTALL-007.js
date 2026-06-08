component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-PUSHINSTALL-007";
payload = {
  "testcase_id": "TC-AGENTINSTALL-PUSHINSTALL-007",
  "description": "Push install with firewall blocking required ports",
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
        "description": "Verify agent NOT installed — firewall blocking"
      }
    }
  ],
  "expected_result": "Push fails — server cannot reach target. No agent installed."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
