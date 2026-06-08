component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-005";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-005",
  "description": "Verify agent log file is created after installation",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs",
        "filename": "DCAgentService.log",
        "description": "Verify DCAgentService.log exists"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_size",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs\\\\DCAgentService.log",
        "expected_size": "0",
        "description": "Verify log file is not empty (size > 0)"
      }
    }
  ],
  "expected_result": "DCAgentService.log exists. Log file has content (size > 0 bytes)."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
