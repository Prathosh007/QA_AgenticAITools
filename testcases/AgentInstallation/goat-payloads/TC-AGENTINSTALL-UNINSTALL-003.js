component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-UNINSTALL-003";
payload = {
  "testcase_id": "TC-AGENTINSTALL-UNINSTALL-003",
  "description": "Uninstall and verify clean re-install (E2E)",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent\\\\bin\\\\DCAgent.exe",
        "args": "/uninstall /s",
        "timeout": 120,
        "description": "Silent uninstall"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceStopped",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify uninstalled"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_not_exists",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "description": "Verify registry gone"
      }
    },
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "verify_absence",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Verify directory gone"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Re-install agent silently"
      }
    },
    {
      "operation_type": "service_actions",
      "parameters": {
        "action": "status",
        "service_name": "ManageEngine UEMS Agent Service",
        "expect": "serviceRunning",
        "max_wait_time": 120,
        "check_interval": 5,
        "description": "Verify re-install succeeded"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify registry recreated"
      }
    }
  ],
  "expected_result": "Uninstall completes cleanly. Re-install succeeds. Service RUNNING. Registry present."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
