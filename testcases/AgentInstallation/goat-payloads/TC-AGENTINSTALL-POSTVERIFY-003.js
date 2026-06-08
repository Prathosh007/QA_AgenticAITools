component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-003",
  "description": "Verify install directory structure after installation",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify UEMS_Agent directory"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin",
        "description": "Verify bin directory"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\conf",
        "description": "Verify conf directory"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs",
        "description": "Verify logs directory"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "check_presence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin",
        "filename": "DCAgentService.exe",
        "description": "Verify DCAgentService.exe exists"
      }
    }
  ],
  "expected_result": "All directories exist: UEMS_Agent\\, bin\\, conf\\, logs\\. DCAgentService.exe present in bin\\."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
