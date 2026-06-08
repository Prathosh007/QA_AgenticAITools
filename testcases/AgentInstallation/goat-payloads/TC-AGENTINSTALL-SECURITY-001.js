component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SECURITY-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SECURITY-001",
  "description": "Verify agent service runs under SYSTEM account",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "get_logon",
        "service_name": "ManageEngine UEMS Agent Service",
        "note": "logon_account",
        "description": "Get service logon account"
      }
    }
  ],
  "expected_result": "Service logon account is LocalSystem or NT AUTHORITY\\SYSTEM."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
