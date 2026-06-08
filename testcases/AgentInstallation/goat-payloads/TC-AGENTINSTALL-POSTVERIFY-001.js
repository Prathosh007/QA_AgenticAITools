component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-001",
  "description": "Verify agent service startup type is Automatic after install",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "get_startup",
        "service_name": "ManageEngine UEMS Agent Service",
        "note": "startup_type",
        "description": "Get agent service startup type"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_dword",
        "root": "HKLM",
        "path": "SYSTEM\\\\CurrentControlSet\\\\Services\\\\DCAgent",
        "key_name": "Start",
        "expected_value": "2",
        "description": "Verify registry Start=2 (Automatic)"
      }
    }
  ],
  "expected_result": "Service startup type is Automatic (AUTO). Registry Start=2."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
