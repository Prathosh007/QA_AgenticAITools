component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-SECURITY-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-SECURITY-002",
  "description": "Verify agent install directory permissions",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_permission",
        "path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "permissions": "w",
        "user": "Users",
        "description": "Check standard users do NOT have write access"
      }
    }
  ],
  "expected_result": "Standard users have read/execute only — no write access. SYSTEM and Administrators have full control."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
