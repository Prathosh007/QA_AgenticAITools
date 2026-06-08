component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-INTEGRATION-001";
payload = {
  "testcase_id": "TC-AGENTINSTALL-INTEGRATION-001",
  "description": "Agent registers with Distribution Server after install",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "note": "ds_name",
        "description": "Read DS name from registry"
      }
    },
    {
      "operation_type": "file_folder_modification",
      "parameters": {
        "action": "value_should_be_present",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\logs\\\\DCAgentService.log",
        "value": "successfully",
        "description": "Verify log contains successful connection message"
      }
    }
  ],
  "expected_result": "Agent connects to configured DS. Log contains successful registration messages."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
