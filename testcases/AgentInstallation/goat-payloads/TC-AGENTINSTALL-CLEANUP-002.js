component = $LocalOffice_WinAgent1;
testcaseId = "TC-AGENTINSTALL-CLEANUP-002";
payload = {
  "testcase_id": "TC-AGENTINSTALL-CLEANUP-002",
  "description": "Partial uninstall leaves stale registry — verify re-install handles it",
  "reuse_installation": false,
  "operations": [
    {
      "operation_type": "file_folder_operation",
      "parameters": {
        "action": "delete",
        "file_path": "C:\\\\Program Files (x86)\\\\ManageEngine\\\\UEMS_Agent",
        "description": "Manually delete install directory (simulate partial uninstall)"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "check_key_exists",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "description": "Verify stale registry keys still exist"
      }
    },
    {
      "operation_type": "run_bat",
      "parameters": {
        "action": "execute",
        "file_path": "agent_home\\\\..\\\\..\\\\Installers\\\\LocalOffice_Agent.exe",
        "args": "/silent",
        "timeout": 120,
        "description": "Fresh install over stale registry"
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
        "description": "Verify service RUNNING"
      }
    },
    {
      "operation_type": "registry_operation",
      "parameters": {
        "action": "read_key",
        "root": "HKLM",
        "path": "SOFTWARE\\\\AdventNet\\\\DesktopCentral\\\\DCAgent",
        "key_name": "ServerName",
        "description": "Verify registry updated"
      }
    }
  ],
  "expected_result": "Fresh install handles stale registry gracefully. Agent installs. Service RUNNING."
};
goat.common_funtions.goatexecutewithpayload(payload.toString(), component);
goat.common_funtions.goatstatusapiwithid(testcaseId, 90, component);
