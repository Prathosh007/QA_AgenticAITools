component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-POSTVERIFY-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-POSTVERIFY-002",
  "description": "Verify all required registry keys after installation",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Read ServerName — should not be empty"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerPort",
        "description": "Read ServerPort — should have valid port"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "AgentVersion",
        "description": "Read AgentVersion — should have version string"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "InstallDir",
        "description": "Read InstallDir — should point to install path"
      }
    }
  ],
  "expected_result": "ServerName has DS/server hostname. ServerPort has valid port. AgentVersion has version. InstallDir=C:\\Program Files (x86)\\ManageEngine\\UEMS_Agent\\."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
